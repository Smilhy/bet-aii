-- WERSJA 973 — trwały zapis statystyk: poprawka profit/yield po resecie
-- Wklej CAŁY kod do Supabase SQL Editor.
-- Ważne: ten kod NIE używa bet_amount/course i NIE ucina $$.
-- Profit jest liczony z wyniku, stawki i kursu; profit=0 w rekordzie nie blokuje wygranej.

drop trigger if exists trg_recalculate_profile_tip_stats on public.tips;
drop function if exists public.handle_tip_stats_recalculate();
drop function if exists public.recalculate_profile_tip_stats(uuid);

create or replace function public.recalculate_profile_tip_stats(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
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
      x.author_id,
      count(*)::int as total_tips,

      count(*) filter (where x.status_norm = 'won')::int as won_tips,
      count(*) filter (where x.status_norm = 'lost')::int as lost_tips,
      count(*) filter (where x.status_norm not in ('won', 'lost', 'void'))::int as pending_tips,

      coalesce(sum(
        case when x.status_norm in ('won', 'lost') then x.stake else 0 end
      ), 0)::numeric as total_staked,

      coalesce(sum(
        case
          when x.status_norm = 'won' then x.stake * greatest(x.odds - 1, 0)
          when x.status_norm = 'lost' then -x.stake
          when x.status_norm = 'void' then 0
          else 0
        end
      ), 0)::numeric as profit,

      coalesce(avg(nullif(x.odds, 0)), 0)::numeric as avg_odds,
      coalesce(max(x.odds), 0)::numeric as highest_odds

    from (
      select
        t.author_id,

        case
          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
            ('won','win','wygrany','wygrana','wygrał','wygral','green','success')
          then 'won'

          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
            ('lost','loss','lose','przegrany','przegrana','przegrał','przegral','red','failed')
          then 'lost'

          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
            ('void','push','zwrot','return','cancelled','canceled','anulowany')
          then 'void'

          else 'pending'
        end as status_norm,

        coalesce(nullif(to_jsonb(t)->>'stake', '')::numeric, 0) as stake,
        coalesce(nullif(to_jsonb(t)->>'odds', '')::numeric, 0) as odds

      from public.tips t
      where t.author_id = p_profile_id
    ) x
    group by x.author_id
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
    and not exists (
      select 1
      from public.tips t
      where t.author_id = p_profile_id
    );
end;
$func$;

create or replace function public.handle_tip_stats_recalculate()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
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
$func$;

create trigger trg_recalculate_profile_tip_stats
after insert or update or delete on public.tips
for each row
execute function public.handle_tip_stats_recalculate();

do $func$
declare
  r record;
begin
  for r in select id from public.profiles
  loop
    perform public.recalculate_profile_tip_stats(r.id);
  end loop;
end;
$func$;
