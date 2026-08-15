-- BetAI WERSJA 1806 — naprawa kontynuacji statystyk smilhytv
-- Uruchom JEDEN RAZ w Supabase -> SQL Editor -> Run.
--
-- Przyczyna awarii:
-- stary trigger trg_recalculate_profile_tip_stats po dodaniu nowego typu
-- nadpisywał historyczne imported_* statystykami policzonymi wyłącznie
-- z tabeli tips. Dlatego po pierwszym nowym typie 812 zmieniało się na 1.
--
-- Ta poprawka:
-- 1. przywraca bazę Betfolio: 812 typów, 474 wygrane, 338 przegrane, 0 pending,
-- 2. zachowuje już dodane po imporcie typy jako kontynuację,
-- 3. blokuje nadpisywanie historycznej bazy dla profili additive/baseline,
-- 4. pozostawia stare automatyczne przeliczanie bez zmian dla pozostałych kont.

begin;

alter table public.profiles
  add column if not exists imported_stats_additive boolean not null default false;

alter table public.profiles
  add column if not exists imported_stats_mode text;

alter table public.profiles
  add column if not exists imported_void_tips integer not null default 0;

alter table public.profiles add column if not exists imported_yield numeric default 0;
alter table public.profiles add column if not exists imported_total_tips integer default 0;
alter table public.profiles add column if not exists imported_won_tips integer default 0;
alter table public.profiles add column if not exists imported_lost_tips integer default 0;
alter table public.profiles add column if not exists imported_pending_tips integer default 0;
alter table public.profiles add column if not exists imported_total_staked numeric default 0;
alter table public.profiles add column if not exists imported_profit numeric default 0;
alter table public.profiles add column if not exists imported_avg_odds numeric default 0;
alter table public.profiles add column if not exists imported_highest_odds numeric default 0;
alter table public.profiles add column if not exists imported_tips_amount numeric default 0;
alter table public.profiles add column if not exists imported_tips_currency text default 'zł';
alter table public.profiles add column if not exists stats_imported_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- 1. Napraw funkcję przeliczającą, zanim odtworzymy historyczną bazę.
--    Dla imported_stats_additive=true imported_* są NIETYKALNĄ bazą historyczną.
--    Nowe rekordy z tips są dodawane do niej przez frontend od stats_imported_at.
-- ---------------------------------------------------------------------------

drop trigger if exists trg_recalculate_profile_tip_stats on public.tips;

drop function if exists public.handle_tip_stats_recalculate();
drop function if exists public.recalculate_profile_tip_stats(uuid);

create or replace function public.recalculate_profile_tip_stats(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_additive boolean := false;
begin
  select
    coalesce(p.imported_stats_additive, false)
    or lower(coalesce(p.imported_stats_mode, '')) = 'baseline'
  into v_additive
  from public.profiles p
  where p.id = p_profile_id;

  -- Najważniejsza blokada v1806:
  -- profil z historyczną bazą nie może mieć imported_* nadpisanych liczbą
  -- nowych rekordów znajdujących się obecnie w public.tips.
  if coalesce(v_additive, false) then
    return;
  end if;

  update public.profiles p
  set
    imported_total_tips = coalesce(s.total_tips, 0),
    imported_won_tips = coalesce(s.won_tips, 0),
    imported_lost_tips = coalesce(s.lost_tips, 0),
    imported_void_tips = coalesce(s.void_tips, 0),
    imported_pending_tips = coalesce(s.pending_tips, 0),
    imported_total_staked = coalesce(s.settled_staked, 0),
    imported_profit = coalesce(s.profit, 0),
    imported_avg_odds = coalesce(s.avg_odds, 0),
    imported_highest_odds = coalesce(s.highest_odds, 0),
    imported_yield = case
      when coalesce(s.settled_staked, 0) > 0
      then round((coalesce(s.profit, 0) / s.settled_staked) * 100, 2)
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
      count(*) filter (where x.status_norm = 'void')::int as void_tips,
      count(*) filter (where x.status_norm not in ('won', 'lost', 'void'))::int as pending_tips,
      coalesce(sum(case when x.status_norm in ('won', 'lost') then x.stake else 0 end), 0)::numeric as settled_staked,
      coalesce(sum(
        case
          when x.status_norm = 'won' then x.stake * greatest(x.odds - 1, 0)
          when x.status_norm = 'lost' then -x.stake
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
    imported_void_tips = 0,
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
begin
  if tg_op = 'DELETE' then
    if old.author_id is not null then
      perform public.recalculate_profile_tip_stats(old.author_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.author_id is distinct from new.author_id
     and old.author_id is not null then
    perform public.recalculate_profile_tip_stats(old.author_id);
  end if;

  if new.author_id is not null then
    perform public.recalculate_profile_tip_stats(new.author_id);
  end if;

  return new;
end;
$func$;

create trigger trg_recalculate_profile_tip_stats
after insert or update or delete on public.tips
for each row
execute function public.handle_tip_stats_recalculate();

-- ---------------------------------------------------------------------------
-- 2. Przywróć prawidłową historyczną bazę profilu smilhytv.
--    Cutoff ustawiamy sekundę przed najstarszym aktualnym typem smilhytv,
--    dzięki czemu typ już dodany po imporcie pozostanie jako +1 pending.
-- ---------------------------------------------------------------------------

with target as (
  select p.id
  from public.profiles p
  where p.id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'::uuid
     or lower(coalesce(to_jsonb(p)->>'email', '')) = 'smilhytv@gmail.com'
     or lower(coalesce(to_jsonb(p)->>'username', '')) = 'smilhytv'
     or lower(coalesce(to_jsonb(p)->>'public_slug', '')) = 'smilhytv'
), cutoff as (
  select
    target.id,
    coalesce(
      (
        select min(nullif(to_jsonb(t)->>'created_at', '')::timestamptz) - interval '1 second'
        from public.tips t
        where coalesce(to_jsonb(t)->>'author_id', '') = target.id::text
           or coalesce(to_jsonb(t)->>'user_id', '') = target.id::text
           or coalesce(to_jsonb(t)->>'tipster_id', '') = target.id::text
           or lower(coalesce(to_jsonb(t)->>'author_email', '')) = 'smilhytv@gmail.com'
           or lower(coalesce(to_jsonb(t)->>'user_email', '')) = 'smilhytv@gmail.com'
           or lower(coalesce(to_jsonb(t)->>'email', '')) = 'smilhytv@gmail.com'
           or lower(coalesce(to_jsonb(t)->>'author_name', '')) = 'smilhytv'
           or lower(coalesce(to_jsonb(t)->>'username', '')) = 'smilhytv'
      ),
      now()
    ) as imported_cutoff
  from target
)
update public.profiles p
set
  imported_stats_additive = true,
  imported_stats_mode = 'baseline',
  imported_total_tips = 812,
  imported_won_tips = 474,
  imported_lost_tips = 338,
  imported_void_tips = 0,
  imported_pending_tips = 0,
  imported_total_staked = 246510.00,
  imported_profit = 85963.39,
  imported_yield = 34.87,
  imported_avg_odds = 1.84,
  imported_highest_odds = 48.00,
  imported_tips_amount = 0,
  imported_tips_currency = coalesce(nullif(p.imported_tips_currency, ''), 'zł'),
  stats_imported_at = cutoff.imported_cutoff,
  updated_at = now()
from cutoff
where p.id = cutoff.id;

commit;

-- ---------------------------------------------------------------------------
-- KONTROLA PO URUCHOMIENIU
-- Przy jednym świeżo dodanym, nierozliczonym typie oczekiwany wynik to:
-- baza_typow = 812, nowe_typy = 1, razem_typy = 813, razem_pending = 1.
-- ---------------------------------------------------------------------------

with target as (
  select p.*
  from public.profiles p
  where p.id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'::uuid
     or lower(coalesce(to_jsonb(p)->>'email', '')) = 'smilhytv@gmail.com'
     or lower(coalesce(to_jsonb(p)->>'username', '')) = 'smilhytv'
     or lower(coalesce(to_jsonb(p)->>'public_slug', '')) = 'smilhytv'
  limit 1
), live as (
  select
    count(*)::int as total,
    count(*) filter (
      where lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
        ('won','win','wygrany','wygrana','wygrał','wygral','green','success')
    )::int as won,
    count(*) filter (
      where lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
        ('lost','loss','lose','przegrany','przegrana','przegrał','przegral','red','failed')
    )::int as lost,
    count(*) filter (
      where lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) not in
        ('won','win','wygrany','wygrana','wygrał','wygral','green','success',
         'lost','loss','lose','przegrany','przegrana','przegrał','przegral','red','failed',
         'void','push','zwrot','return','cancelled','canceled','anulowany')
    )::int as pending
  from public.tips t, target p
  where (
       coalesce(to_jsonb(t)->>'author_id', '') = p.id::text
    or coalesce(to_jsonb(t)->>'user_id', '') = p.id::text
    or coalesce(to_jsonb(t)->>'tipster_id', '') = p.id::text
    or lower(coalesce(to_jsonb(t)->>'author_email', '')) = lower(coalesce(p.email, ''))
    or lower(coalesce(to_jsonb(t)->>'author_name', '')) = lower(coalesce(p.username, ''))
  )
  and nullif(to_jsonb(t)->>'created_at', '')::timestamptz > p.stats_imported_at
)
select
  p.id,
  p.username,
  p.imported_stats_additive,
  p.imported_stats_mode,
  p.imported_total_tips as baza_typow,
  p.imported_won_tips as baza_wygranych,
  p.imported_lost_tips as baza_przegranych,
  p.imported_pending_tips as baza_pending,
  live.total as nowe_typy,
  p.imported_total_tips + live.total as razem_typy,
  p.imported_won_tips + live.won as razem_wygrane,
  p.imported_lost_tips + live.lost as razem_przegrane,
  p.imported_pending_tips + live.pending as razem_pending,
  p.stats_imported_at
from target p
cross join live;
