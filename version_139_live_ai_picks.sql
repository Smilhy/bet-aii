-- =========================
-- VERSION 135 — AI TAB REAL EVENTS LAYOUT + STRICT SEPARATION
-- =========================

-- Required columns for AI-only events. Safe if already exists.
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists implied_probability numeric default 0;
alter table public.tips add column if not exists model_probability numeric default 0;
alter table public.tips add column if not exists risk_level text default 'medium';
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists sport text default 'football';
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists pick text;

-- Critical: all human/tipster picks stay as user picks.
update public.tips
set ai_source = 'user'
where ai_source is null
   or ai_source = ''
   or ai_source <> 'real_ai_engine';

-- Optional cleanup: remove previous AI-generated/test rows only.
-- This does NOT remove human/tipster dashboard picks.
delete from public.tips
where ai_source = 'real_ai_engine';

-- New user-created picks must default to Dashboard/user feed.
alter table public.tips alter column ai_source set default 'user';

-- Dashboard/feed: only human/tipster picks.
create or replace view public.user_only_tips as
select *
from public.tips
where coalesce(ai_source, 'user') = 'user'
order by created_at desc;

-- Typy AI tab: only backend-created real AI picks.
create or replace view public.ai_only_picks as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by ai_score desc, value_score desc, created_at desc;

create or replace view public.top_ai_picks as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by value_score desc, ai_confidence desc, created_at desc
limit 50;

-- AI stats for the AI tab.
create or replace view public.ai_stats_summary as
select
  count(*) as total_picks,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result in ('lose','loss','lost')) as losses,
  count(*) filter (where result is null or result = 'pending') as pending,
  round(case when count(*) filter (where result in ('win','lose','loss','lost')) > 0
    then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose','loss','lost'))::numeric) * 100
    else 0 end, 2) as winrate,
  round(coalesce(sum(case when result = 'win' then coalesce(odds,0)-1 when result in ('lose','loss','lost') then -1 else 0 end),0),2) as profit_units,
  round(avg(coalesce(ai_confidence,0)),2) as avg_confidence,
  round(avg(coalesce(value_score,0)),2) as avg_value_score
from public.tips
where ai_source = 'real_ai_engine';

create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  status text default 'pending',
  source text default 'api_football_odds_openai',
  picks_created integer default 0,
  error_message text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

alter table public.ai_pick_runs enable row level security;
drop policy if exists "ai_pick_runs_admin_read" on public.ai_pick_runs;
create policy "ai_pick_runs_admin_read"
on public.ai_pick_runs
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.email = 'smilhytv@gmail.com'
  )
);

alter table public.tips enable row level security;
drop policy if exists "tips_public_read_v135" on public.tips;
create policy "tips_public_read_v135"
on public.tips
for select
using (true);
