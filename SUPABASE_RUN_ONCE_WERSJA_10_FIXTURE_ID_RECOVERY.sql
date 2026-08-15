-- BETAI WERSJA 10 — ODZYSKANIE FIXTURE_ID DLA BOTÓW
-- Uruchom jeden raz w Supabase SQL Editor.
-- Skrypt:
-- 1) zapewnia krytyczne kolumny,
-- 2) próbuje odzyskać ID z ai_bets,
-- 3) próbuje odzyskać ID z sports_fixture_cache,
-- 4) uzupełnia klucze rynku dla widocznych typów.

begin;

alter table if exists public.tips add column if not exists fixture_id text;
alter table if exists public.tips add column if not exists api_fixture_id text;
alter table if exists public.tips add column if not exists external_fixture_id text;
alter table if exists public.tips add column if not exists market_key text;
alter table if exists public.tips add column if not exists selection_key text;
alter table if exists public.tips add column if not exists settlement_reason text;
alter table if exists public.tips add column if not exists settlement_status text;
alter table if exists public.tips add column if not exists result_status text;
alter table if exists public.tips add column if not exists result text;
alter table if exists public.tips add column if not exists settled_at timestamptz;
alter table if exists public.tips add column if not exists updated_at timestamptz default now();
alter table if exists public.tips add column if not exists profit numeric default 0;
alter table if exists public.tips add column if not exists payout numeric default 0;
alter table if exists public.tips add column if not exists return_amount numeric default 0;

-- A. Odzyskanie ID z tabeli ai_bets.
-- Dotyczy przede wszystkim meczu LDU de Quito — Orense SC,
-- który główny BetAI zapisał również w ai_bets z external_fixture_id.
with candidates as (
  select
    t.id as tip_id,
    nullif(trim(ab.external_fixture_id::text), '') as recovered_id,
    row_number() over (
      partition by t.id
      order by abs(extract(epoch from (coalesce(ab.created_at, now()) - coalesce(t.created_at, now()))))
    ) as rn
  from public.tips t
  join public.ai_bets ab
    on regexp_replace(lower(coalesce(t.team_home, '')), '[^[:alnum:]]+', '', 'g')
       = regexp_replace(lower(coalesce(ab.home_team, '')), '[^[:alnum:]]+', '', 'g')
   and regexp_replace(lower(coalesce(t.team_away, '')), '[^[:alnum:]]+', '', 'g')
       = regexp_replace(lower(coalesce(ab.away_team, '')), '[^[:alnum:]]+', '', 'g')
  where t.author_name in ('BetAI MultiSport AI', 'Typer Expert', 'Ograć Buka')
    and coalesce(nullif(trim(t.fixture_id), ''), nullif(trim(t.api_fixture_id), ''), nullif(trim(t.external_fixture_id), '')) is null
    and nullif(trim(ab.external_fixture_id::text), '') is not null
)
update public.tips t
set
  fixture_id = c.recovered_id,
  api_fixture_id = c.recovered_id,
  external_fixture_id = c.recovered_id,
  updated_at = now()
from candidates c
where c.tip_id = t.id
  and c.rn = 1
  and c.recovered_id ~ '^[0-9]+$';

-- B. Odzyskanie ID z cache meczów.
-- Zadziała również dla Typer Expert, jeżeli mecz nadal jest w sports_fixture_cache.
with cache_candidates as (
  select
    t.id as tip_id,
    coalesce(
      nullif(trim(c.fixture_json->>'apiFixtureId'), ''),
      nullif(trim(c.fixture_json->>'fixtureId'), ''),
      nullif(trim(c.fixture_json->>'id'), ''),
      case when trim(c.cache_key) ~ '^[0-9]+$' then trim(c.cache_key) end
    ) as recovered_id,
    row_number() over (
      partition by t.id
      order by c.fetched_at desc nulls last, c.commence_time desc nulls last
    ) as rn
  from public.tips t
  join public.sports_fixture_cache c
    on regexp_replace(lower(coalesce(t.team_home, '')), '[^[:alnum:]]+', '', 'g')
       = regexp_replace(lower(coalesce(c.home, '')), '[^[:alnum:]]+', '', 'g')
   and regexp_replace(lower(coalesce(t.team_away, '')), '[^[:alnum:]]+', '', 'g')
       = regexp_replace(lower(coalesce(c.away, '')), '[^[:alnum:]]+', '', 'g')
  where t.author_name in ('BetAI MultiSport AI', 'Typer Expert', 'Ograć Buka')
    and coalesce(nullif(trim(t.fixture_id), ''), nullif(trim(t.api_fixture_id), ''), nullif(trim(t.external_fixture_id), '')) is null
)
update public.tips t
set
  fixture_id = c.recovered_id,
  api_fixture_id = c.recovered_id,
  external_fixture_id = c.recovered_id,
  updated_at = now()
from cache_candidates c
where c.tip_id = t.id
  and c.rn = 1
  and c.recovered_id ~ '^[0-9]+$';

-- C. Klucze rynku dla obecnych rekordów.
update public.tips
set
  market_key = case
    when lower(coalesce(bet_type, '')) like '%powyżej%2.5%'
      or lower(coalesce(bet_type, '')) like '%powyzej%2.5%'
      or lower(coalesce(bet_type, '')) like '%over%2.5%'
      then 'goals_over_under'
    when lower(coalesce(bet_type, '')) like '%poniżej%2.5%'
      or lower(coalesce(bet_type, '')) like '%ponizej%2.5%'
      or lower(coalesce(bet_type, '')) like '%under%2.5%'
      then 'goals_over_under'
    when lower(coalesce(bet_type, '')) like '%wygra%'
      then 'match_winner'
    else market_key
  end,
  selection_key = case
    when lower(coalesce(bet_type, '')) like '%powyżej%2.5%'
      or lower(coalesce(bet_type, '')) like '%powyzej%2.5%'
      or lower(coalesce(bet_type, '')) like '%over%2.5%'
      then 'over_2_5'
    when lower(coalesce(bet_type, '')) like '%poniżej%2.5%'
      or lower(coalesce(bet_type, '')) like '%ponizej%2.5%'
      or lower(coalesce(bet_type, '')) like '%under%2.5%'
      then 'under_2_5'
    when lower(coalesce(bet_type, '')) like '%' || lower(coalesce(team_home, '')) || '%wygra%'
      then 'home'
    when lower(coalesce(bet_type, '')) like '%' || lower(coalesce(team_away, '')) || '%wygra%'
      then 'away'
    else selection_key
  end,
  updated_at = now()
where author_name in ('BetAI MultiSport AI', 'Typer Expert', 'Ograć Buka')
  and (market_key is null or selection_key is null);

commit;

-- Kontrola po wykonaniu.
select
  id,
  author_name,
  team_home,
  team_away,
  bet_type,
  fixture_id,
  api_fixture_id,
  external_fixture_id,
  market_key,
  selection_key,
  status,
  settlement_status,
  created_at
from public.tips
where author_name in ('BetAI MultiSport AI', 'Typer Expert', 'Ograć Buka')
  and (
    status is null
    or lower(status) in ('pending', 'live')
    or settlement_status is null
    or lower(settlement_status) in ('pending', 'live')
  )
order by created_at desc;
