-- =========================
-- VERSION 136 — AI PICKS DASHBOARD PREMIUM
-- Safe rebuild of AI tab views. Does NOT delete user tips.
-- =========================

-- Clean old views first, because PostgreSQL cannot change view columns with CREATE OR REPLACE.
drop view if exists public.ai_events_feed cascade;
drop view if exists public.ai_events_status cascade;
drop view if exists public.ai_events_summary cascade;
drop view if exists public.ai_stats_main cascade;
drop view if exists public.ai_stats_by_league cascade;
drop view if exists public.ai_recent_events cascade;
drop view if exists public.ai_streak cascade;
drop view if exists public.ai_recent_form cascade;
drop view if exists public.ai_stats_by_odds_range cascade;
drop view if exists public.ai_only_picks cascade;
drop view if exists public.user_only_tips cascade;

-- Required columns for AI engine and UI.
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists pick text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists result text;
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists implied_probability numeric default 0;
alter table public.tips add column if not exists model_probability numeric default 0;
alter table public.tips add column if not exists risk_level text default 'medium';
alter table public.tips add column if not exists sport text default 'football';
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists kickoff_time timestamptz;

-- Make sure normal user tips stay on dashboard. Only backend AI should use real_ai_engine.
update public.tips
set ai_source = 'user'
where ai_source is null or ai_source = '';

alter table public.tips alter column ai_source set default 'user';

-- Dashboard: user/tipster feed only.
create view public.user_only_tips as
select *
from public.tips
where coalesce(ai_source, 'user') = 'user'
order by created_at desc;

-- AI tab: only real AI engine picks.
create view public.ai_only_picks as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by coalesce(kickoff_time, match_time, created_at) desc nulls last;

create view public.ai_events_feed as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by coalesce(kickoff_time, match_time, created_at) desc nulls last;

create view public.ai_events_status as
select
  *,
  case
    when result in ('win','won','lose','loss','lost','void','push') then 'finished'
    when coalesce(kickoff_time, match_time, created_at) <= now() then 'live'
    else 'upcoming'
  end as ai_status
from public.ai_events_feed;

create view public.ai_events_summary as
select
  count(*) filter (where ai_status = 'live') as live_now,
  count(*) filter (where ai_status = 'upcoming') as upcoming,
  count(*) filter (where ai_status = 'finished') as finished,
  count(*) as total
from public.ai_events_status;

create view public.ai_stats_main as
select
  count(*) as total_picks,
  count(*) filter (where result in ('win','won')) as wins,
  count(*) filter (where result in ('lose','loss','lost')) as losses,
  count(*) filter (where result in ('void','push')) as pushes,
  round(case when count(*) filter (where result in ('win','won','lose','loss','lost')) > 0 then (count(*) filter (where result in ('win','won'))::numeric / count(*) filter (where result in ('win','won','lose','loss','lost'))::numeric) * 100 else 0 end, 2) as winrate,
  round(coalesce(sum(case when result in ('win','won') then (coalesce(odds,0)-1)*100 when result in ('lose','loss','lost') then -100 else coalesce(profit,0) end),0),2) as total_profit,
  round(case when count(*) filter (where result in ('win','won','lose','loss','lost')) > 0 then (coalesce(sum(case when result in ('win','won') then (coalesce(odds,0)-1)*100 when result in ('lose','loss','lost') then -100 else 0 end),0) / (count(*) filter (where result in ('win','won','lose','loss','lost')) * 100)::numeric) * 100 else 0 end, 2) as roi,
  round(avg(coalesce(ai_confidence,0)),2) as avg_confidence,
  round(avg(coalesce(value_score,0)),2) as avg_value_score
from public.tips
where ai_source = 'real_ai_engine';

create view public.ai_stats_by_league as
select
  coalesce(league_name, league, 'Unknown') as league,
  count(*) as picks,
  count(*) filter (where result in ('win','won')) as wins,
  count(*) filter (where result in ('lose','loss','lost')) as losses,
  round(case when count(*) filter (where result in ('win','won','lose','loss','lost')) > 0 then (count(*) filter (where result in ('win','won'))::numeric / count(*) filter (where result in ('win','won','lose','loss','lost'))::numeric) * 100 else 0 end, 2) as winrate,
  round(coalesce(sum(case when result in ('win','won') then (coalesce(odds,0)-1)*100 when result in ('lose','loss','lost') then -100 else coalesce(profit,0) end),0),2) as profit,
  round(avg(coalesce(ai_confidence,0)),2) as avg_confidence
from public.tips
where ai_source = 'real_ai_engine'
group by coalesce(league_name, league, 'Unknown')
order by picks desc, winrate desc;

create view public.ai_recent_form as
select result, created_at
from public.tips
where ai_source = 'real_ai_engine'
order by created_at desc
limit 20;

create view public.ai_stats_by_odds_range as
select
  case
    when odds < 1.50 then '1.01 - 1.50'
    when odds >= 1.50 and odds < 2.00 then '1.51 - 2.00'
    when odds >= 2.00 and odds < 2.50 then '2.01 - 2.50'
    when odds >= 2.50 and odds < 3.00 then '2.51 - 3.00'
    when odds >= 3.00 then '3.01+'
    else 'Unknown'
  end as odds_range,
  count(*) as total,
  count(*) filter (where result in ('win','won')) as wins,
  count(*) filter (where result in ('lose','loss','lost')) as losses
from public.tips
where ai_source = 'real_ai_engine'
group by 1
order by 1;

alter table public.tips enable row level security;
drop policy if exists "tips_public_read_v136" on public.tips;
create policy "tips_public_read_v136" on public.tips for select using (true);
