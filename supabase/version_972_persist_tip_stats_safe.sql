-- WERSJA 972 — bezpieczny trwały zapis statystyk typera
-- Nie używa nieistniejących kolumn typu bet_amount/course.
-- Czyta dane z public.tips przez to_jsonb(t), więc nie wywala błędu, jeśli kolumna nie istnieje.

drop trigger if exists trg_recalculate_profile_tip_stats on public.tips;
drop function if exists public.handle_tip_stats_recalculate();
drop function if exists public.recalculate_profile_tip_stats(uuid);

create or replace function public.recalculate_profile_tip_stats(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    imported_total_tips = coalesce(s.total_tips, 0),
    imported_won_tips = coalesce(s.won_tips, 0),
    imported_lost_tips = coalesce(s.lost_tips, 0),
    imported_pending_tips = coalesce(s.pending_tips, 0),
    imported_total_staked = coalesce(s.total_staked, 0),
    imported_profit = coalesce(s.profit, 0),
    imported_avg_odds = coalesce(s.avg_odds, 0),
    imported_highest_odds = coalesce(s.highest_odds, 0),
    imported_yield = case
      when coalesce(s.total_staked, 0) > 0
      then round((coalesce(s.profit, 0) / s.total_staked) * 100, 2)
      else 0
    end,
    imported_tips_amount = coalesce(s.total_tips, 0),
    stats_imported_at = now()
  from (
    select
      t.author_id,
      count(*)::int as total_tips,
      count(*) filter (
        where lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', '')) in ('won','win','wygrany','wygrana')
      )::int as won_tips,
      count(*) filter (
        where lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', '')) in ('lost','loss','lose','przegrany','przegrana')
      )::int as lost_tips,
      count(*) filter (
        where lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', '')) not in (
          'won','win','wygrany','wygrana',
          'lost','loss','lose','przegrany','przegrana',
          'void','push','zwrot'
        )
      )::int as pending_tips,
      coalesce(sum(
        case
          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', '')) in (
            'won','win','wygrany','wygrana',
            'lost','loss','lose','przegrany','przegrana'
          )
          then coalesce(nullif(to_jsonb(t)->>'stake', '')::numeric, 0)
          else 0
        end
      ), 0)::numeric as total_staked,
      coalesce(sum(
        case
          when nullif(to_jsonb(t)->>'profit', '') is not null
            then coalesce(nullif(to_jsonb(t)->>'profit', '')::numeric, 0)
          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', '')) in ('won','win','wygrany','wygrana')
            then coalesce(nullif(to_jsonb(t)->>'stake', '')::numeric, 0)
                 * greatest(coalesce(nullif(to_jsonb(t)->>'odds', '')::numeric, 0) - 1, 0)
          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', '')) in ('lost','loss','lose','przegrany','przegrana')
            then -coalesce(nullif(to_jsonb(t)->>'stake', '')::numeric, 0)
          else 0
        end
      ), 0)::numeric as profit,
      coalesce(avg(nullif(to_jsonb(t)->>'odds', '')::numeric), 0)::numeric as avg_odds,
      coalesce(max(coalesce(nullif(to_jsonb(t)->>'odds', '')::numeric, 0)), 0)::numeric as highest_odds
    from public.tips t
    where t.author_id = p_profile_id
    group by t.author_id
  ) s
  where p.id = p_profile_id
    and p.id = s.author_id;

  update public.profiles p
  set
    imported_yield = 0,
    imported_total_tips = 0,
    imported_won_tips = 0,
    imported_lost_tips = 0,
    imported_pending_tips = 0,
    imported_total_staked = 0,
    imported_profit = 0,
    imported_avg_odds = 0,
    imported_highest_odds = 0,
    imported_tips_amount = 0,
    stats_imported_at = now()
  where p.id = p_profile_id
    and not exists (select 1 from public.tips t where t.author_id = p_profile_id);
end;
$$;

create or replace function public.handle_tip_stats_recalculate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_author uuid;
begin
  if tg_op = 'DELETE' then
    affected_author := old.author_id;
  else
    affected_author := new.author_id;
  end if;

  if affected_author is not null then
    perform public.recalculate_profile_tip_stats(affected_author);
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_recalculate_profile_tip_stats
after insert or update or delete on public.tips
for each row
execute function public.handle_tip_stats_recalculate();

do $$
declare
  r record;
begin
  for r in select id from public.profiles
  loop
    perform public.recalculate_profile_tip_stats(r.id);
  end loop;
end $$;
