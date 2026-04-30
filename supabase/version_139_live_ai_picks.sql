-- =========================
-- VERSION 139 — LIVE AI PICKS FINAL
-- =========================

alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists pick text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists status text default 'pending';
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists model_probability numeric default 0;
alter table public.tips add column if not exists implied_probability numeric default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists risk_level text default 'medium';
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists live_status text;

create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  status text default 'pending',
  source text default 'ai_engine',
  picks_created integer default 0,
  error_message text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

create index if not exists idx_tips_ai_source_v139 on public.tips(ai_source);
create index if not exists idx_tips_source_v139 on public.tips(source);
create index if not exists idx_tips_live_status_v139 on public.tips(live_status);
create index if not exists idx_tips_event_time_v139 on public.tips(event_time);

-- Dashboard ludzi: tylko user/manual.
drop view if exists public.user_only_tips cascade;
create view public.user_only_tips as
select *
from public.tips
where coalesce(ai_source, 'user') = 'user'
order by created_at desc;

-- Typy AI: pre-match + live, ale tylko engine.
drop view if exists public.ai_events_feed cascade;
create view public.ai_events_feed as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by
  case when source = 'live_ai_engine' then 0 else 1 end,
  coalesce(event_time, kickoff_time, match_time, created_at) desc;

-- LIVE AI only.
drop view if exists public.ai_live_events_feed cascade;
create view public.ai_live_events_feed as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
order by created_at desc;

-- AI stats.
drop view if exists public.ai_stats_main cascade;
create view public.ai_stats_main as
select
  count(*) as total_picks,
  count(*) filter (where source = 'live_ai_engine') as live_picks,
  count(*) filter (where source <> 'live_ai_engine') as prematch_picks,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result in ('lose','loss')) as losses,
  round(
    case when count(*) filter (where result in ('win','lose','loss')) > 0
    then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose','loss'))::numeric) * 100
    else 0 end, 2
  ) as winrate,
  round(coalesce(sum(profit),0), 2) as total_profit,
  round(
    case when count(*) filter (where result in ('win','lose','loss')) > 0
    then (coalesce(sum(profit),0) / count(*) filter (where result in ('win','lose','loss'))::numeric) * 100
    else 0 end, 2
  ) as roi,
  round(avg(coalesce(ai_confidence, 0)), 2) as avg_confidence,
  round(avg(coalesce(value_score, 0)), 2) as avg_value_score
from public.tips
where ai_source = 'real_ai_engine';

-- League stats.
drop view if exists public.ai_stats_by_league cascade;
create view public.ai_stats_by_league as
select
  coalesce(league_name, 'Unknown') as league,
  count(*) as bets,
  count(*) filter (where source = 'live_ai_engine') as live_bets,
  round(avg(coalesce(ai_confidence,0)), 2) as avg_confidence,
  round(
    case when count(*) filter (where result in ('win','lose','loss')) > 0
    then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose','loss'))::numeric) * 100
    else 0 end, 2
  ) as winrate,
  round(coalesce(sum(profit),0), 2) as profit
from public.tips
where ai_source = 'real_ai_engine'
group by coalesce(league_name, 'Unknown')
order by bets desc;

-- Odds performance.
drop view if exists public.ai_stats_by_odds_range cascade;
create view public.ai_stats_by_odds_range as
select
  case
    when odds < 1.5 then '1.0-1.5'
    when odds < 2.0 then '1.5-2.0'
    when odds < 2.5 then '2.0-2.5'
    when odds < 3.0 then '2.5-3.0'
    else '3.0+'
  end as range,
  count(*) as total,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result in ('lose','loss')) as losses
from public.tips
where ai_source = 'real_ai_engine'
group by 1
order by 1;

-- Recent form.
drop view if exists public.ai_recent_form cascade;
create view public.ai_recent_form as
select result, source, created_at
from public.tips
where ai_source = 'real_ai_engine'
order by created_at desc
limit 20;

alter table public.tips enable row level security;
drop policy if exists "tips_public_read_v139" on public.tips;
create policy "tips_public_read_v139"
on public.tips
for select
using (true);

NOTIFY pgrst, 'reload schema';
