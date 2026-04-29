-- =========================
-- VERSION 134 — AI / USER FEED SEPARATION + DEEP STATS
-- Dashboard = typy użytkowników
-- Typy AI = tylko typy wygenerowane przez silnik AI
-- =========================

-- 1) Kolumny potrzebne dla silnika AI i statystyk
alter table public.tips add column if not exists ai_source text;
alter table public.tips add column if not exists source text;
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists implied_probability numeric default 0;
alter table public.tips add column if not exists model_probability numeric default 0;
alter table public.tips add column if not exists risk_level text default 'medium';
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists bookmaker text;

-- 2) Oznaczamy stare typy jako USER, ale ich NIE usuwamy.
-- Realne AI ma zawsze ai_source/source = real_ai_engine.
update public.tips
set
  ai_source = 'user',
  source = coalesce(nullif(source, ''), 'user')
where coalesce(ai_source, source, '') <> 'real_ai_engine';

-- 3) Logi uruchomień generatora AI
create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  source text default 'api-football+odds+openai',
  inserted_count integer default 0,
  status text default 'success',
  error_message text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

alter table public.ai_pick_runs enable row level security;
drop policy if exists "ai_pick_runs_read" on public.ai_pick_runs;
create policy "ai_pick_runs_read"
on public.ai_pick_runs
for select
using (true);

-- 4) Dashboard feed: tylko typy ludzi/typerów
create or replace view public.user_only_tips as
select *
from public.tips
where coalesce(ai_source, source, 'user') <> 'real_ai_engine'
order by created_at desc;

-- 5) Zakładka Typy AI: tylko silnik AI
create or replace view public.ai_only_picks as
select *
from public.tips
where coalesce(ai_source, source, '') = 'real_ai_engine'
order by ai_score desc, value_score desc, ai_confidence desc, created_at desc;

-- 6) Top AI picks — value + confidence
create or replace view public.real_ai_top_picks as
select *
from public.ai_only_picks
where coalesce(ai_score, 0) > 0
order by value_score desc, ai_score desc, ai_confidence desc
limit 50;

-- 7) Statystyki AI — karty jak w dashboardach typu betting stats
create or replace view public.ai_stats_overview as
select
  count(*)::integer as total_picks,
  round(avg(coalesce(ai_confidence, 0)), 2) as avg_confidence,
  round(avg(coalesce(ai_score, 0)), 2) as avg_ai_score,
  round(avg(coalesce(value_score, 0)), 2) as avg_value_score,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('win','won','wygrany'))::integer as wins,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('lose','loss','lost','przegrany'))::integer as losses,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('pending','live'))::integer as pending,
  case
    when count(*) filter (where lower(coalesce(result, status, 'pending')) in ('win','won','lose','loss','lost')) = 0 then 0
    else round(
      (count(*) filter (where lower(coalesce(result, status, 'pending')) in ('win','won'))::numeric /
       nullif(count(*) filter (where lower(coalesce(result, status, 'pending')) in ('win','won','lose','loss','lost')), 0)) * 100,
      2
    )
  end as winrate,
  round(coalesce(sum(
    case
      when lower(coalesce(result, status, 'pending')) in ('win','won','wygrany') then coalesce(odds, 0) - 1
      when lower(coalesce(result, status, 'pending')) in ('lose','loss','lost','przegrany') then -1
      else 0
    end
  ), 0) * 100, 2) as profit_units
from public.tips
where coalesce(ai_source, source, '') = 'real_ai_engine';

-- 8) Performance by league
create or replace view public.ai_stats_by_league as
select
  coalesce(league, league_name, 'Unknown') as league,
  count(*)::integer as picks,
  round(avg(coalesce(ai_confidence, 0)), 2) as avg_confidence,
  round(avg(coalesce(value_score, 0)), 2) as avg_value,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('win','won','wygrany'))::integer as wins,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('lose','loss','lost','przegrany'))::integer as losses
from public.tips
where coalesce(ai_source, source, '') = 'real_ai_engine'
group by coalesce(league, league_name, 'Unknown')
order by picks desc, avg_value desc;

-- 9) Performance by market / typ zakładu
create or replace view public.ai_stats_by_market as
select
  coalesce(bet_type, pick, 'Unknown') as market,
  count(*)::integer as picks,
  round(avg(coalesce(ai_confidence, 0)), 2) as avg_confidence,
  round(avg(coalesce(value_score, 0)), 2) as avg_value,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('win','won','wygrany'))::integer as wins,
  count(*) filter (where lower(coalesce(result, status, 'pending')) in ('lose','loss','lost','przegrany'))::integer as losses
from public.tips
where coalesce(ai_source, source, '') = 'real_ai_engine'
group by coalesce(bet_type, pick, 'Unknown')
order by picks desc, avg_value desc;

-- 10) Buckety ryzyka / confidence
create or replace view public.ai_stats_by_risk as
select
  coalesce(risk_level, 'medium') as risk_level,
  count(*)::integer as picks,
  round(avg(coalesce(ai_confidence, 0)), 2) as avg_confidence,
  round(avg(coalesce(value_score, 0)), 2) as avg_value
from public.tips
where coalesce(ai_source, source, '') = 'real_ai_engine'
group by coalesce(risk_level, 'medium')
order by case coalesce(risk_level, 'medium') when 'low' then 1 when 'medium' then 2 else 3 end;
