-- =========================
-- VERSION 137 — AI GENERATOR SUPABASE V2 FIX
-- =========================

-- Required columns used by the real AI generator Netlify Function
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'user';
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists sport text default 'football';
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists pick text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists model_probability numeric default 0;
alter table public.tips add column if not exists implied_probability numeric default 0;
alter table public.tips add column if not exists risk_level text default 'medium';

-- Run log table for generator
create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  status text default 'pending',
  source text default 'api_football_odds_openai',
  picks_created integer default 0,
  error_message text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

-- Keep old user tips separate from AI picks
update public.tips
set ai_source = 'user'
where ai_source is null or ai_source = '' or ai_source != 'real_ai_engine';

-- Recreate AI views safely
drop view if exists public.ai_events_feed cascade;
drop view if exists public.ai_stats_main cascade;
drop view if exists public.ai_win_loss_distribution cascade;
drop view if exists public.ai_stats_by_odds_range cascade;
drop view if exists public.ai_streak cascade;
drop view if exists public.ai_recent_form cascade;
drop view if exists public.ai_stats_by_league cascade;

create view public.ai_events_feed as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by created_at desc;

create view public.ai_stats_main as
select
  count(*) as total_picks,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'lose') as losses,
  round(
    case when count(*) filter (where result in ('win','lose')) > 0
    then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose'))::numeric) * 100
    else 0 end, 2
  ) as winrate,
  round(coalesce(sum(profit),0), 2) as total_profit,
  round(
    case when count(*) filter (where result in ('win','lose')) > 0
    then (coalesce(sum(profit),0) / count(*) filter (where result in ('win','lose'))::numeric) * 100
    else 0 end, 2
  ) as roi
from public.tips
where ai_source = 'real_ai_engine';

create view public.ai_win_loss_distribution as
select
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'lose') as losses,
  count(*) filter (where result not in ('win','lose') or result is null or result = 'pending') as push
from public.tips
where ai_source = 'real_ai_engine';

create view public.ai_stats_by_odds_range as
select
  case
    when odds < 1.5 then '1.0-1.5'
    when odds < 2.0 then '1.5-2.0'
    when odds < 2.5 then '2.0-2.5'
    when odds < 3.0 then '2.5-3.0'
    else '3.0+'
  end as range,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'lose') as losses
from public.tips
where ai_source = 'real_ai_engine'
group by range
order by range;

create view public.ai_recent_form as
select result
from public.tips
where ai_source = 'real_ai_engine'
order by created_at desc
limit 20;

create view public.ai_stats_by_league as
select
  coalesce(league_name, 'Unknown') as league,
  count(*) as bets,
  round(
    case when count(*) filter (where result in ('win','lose')) > 0
    then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose'))::numeric) * 100
    else 0 end, 2
  ) as winrate,
  round(coalesce(sum(profit),0), 2) as profit,
  round(
    case when count(*) filter (where result in ('win','lose')) > 0
    then (coalesce(sum(profit),0) / count(*) filter (where result in ('win','lose'))::numeric) * 100
    else 0 end, 2
  ) as roi
from public.tips
where ai_source = 'real_ai_engine'
group by league_name
order by bets desc;

create view public.ai_streak as
select
  count(*) filter (where result = 'win') as total_wins,
  count(*) filter (where result = 'lose') as total_losses
from public.tips
where ai_source = 'real_ai_engine';

-- Public reads for frontend
alter table public.tips enable row level security;
drop policy if exists "ai_dashboard_public_read" on public.tips;
create policy "ai_dashboard_public_read" on public.tips for select using (true);

alter table public.ai_pick_runs enable row level security;
drop policy if exists "ai_pick_runs_admin_read" on public.ai_pick_runs;
create policy "ai_pick_runs_admin_read" on public.ai_pick_runs
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.email = 'smilhytv@gmail.com'
  )
);

-- Force PostgREST schema refresh
NOTIFY pgrst, 'reload schema';
