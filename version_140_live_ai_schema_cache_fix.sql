-- =========================
-- VERSION 138 — REAL MATCHES AI ENGINE
-- Real odds + real upcoming matches; no random/fake picks
-- =========================

-- 1. Clean AI dashboard views that may have changed shape
drop view if exists public.ai_events_feed cascade;
drop view if exists public.ai_stats_main cascade;
drop view if exists public.ai_win_loss_distribution cascade;
drop view if exists public.ai_stats_by_odds_range cascade;
drop view if exists public.ai_streak cascade;
drop view if exists public.ai_recent_form cascade;
drop view if exists public.ai_stats_by_league cascade;
drop view if exists public.ai_events_status cascade;
drop view if exists public.ai_events_summary cascade;
drop view if exists public.ai_recent_events cascade;

-- 2. Required metadata columns for real AI picks
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists league text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists sport text default 'football';
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists pick text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists market_key text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists status text default 'pending';
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists model_probability numeric default 0;
alter table public.tips add column if not exists implied_probability numeric default 0;
alter table public.tips add column if not exists risk_level text default 'medium';
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric default 0;

-- 3. Keep human/user feed separate from AI feed
update public.tips
set ai_source = 'user'
where ai_source is null or ai_source = '';

-- 4. AI feed: only real AI engine rows
create view public.ai_events_feed as
select *
from public.tips
where ai_source = 'real_ai_engine'
order by coalesce(event_time, kickoff_time, match_time, created_at) desc;

-- 5. Main AI dashboard stats
create view public.ai_stats_main as
select
  count(*) as total_picks,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'lose') as losses,
  count(*) filter (where result not in ('win','lose') or result is null or result = 'pending') as pending,
  round(
    case
      when count(*) filter (where result in ('win','lose')) > 0
      then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose'))::numeric) * 100
      else 0
    end, 2
  ) as winrate,
  round(coalesce(sum(profit), 0), 2) as total_profit,
  round(
    case
      when count(*) filter (where result in ('win','lose')) > 0
      then (coalesce(sum(profit), 0) / count(*) filter (where result in ('win','lose'))::numeric) * 100
      else 0
    end, 2
  ) as roi,
  round(avg(coalesce(ai_confidence, 0)), 2) as avg_confidence,
  round(avg(coalesce(value_score, 0)), 2) as avg_value_score
from public.tips
where ai_source = 'real_ai_engine';

-- 6. Donut data
create view public.ai_win_loss_distribution as
select
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'lose') as losses,
  count(*) filter (where result not in ('win','lose') or result is null or result = 'pending') as pushes
from public.tips
where ai_source = 'real_ai_engine';

-- 7. Odds range bar data
create view public.ai_stats_by_odds_range as
select
  case
    when odds < 1.50 then '1.01 - 1.50'
    when odds >= 1.50 and odds < 2.00 then '1.51 - 2.00'
    when odds >= 2.00 and odds < 2.50 then '2.01 - 2.50'
    when odds >= 2.50 and odds < 3.00 then '2.51 - 3.00'
    else '3.01+'
  end as odds_range,
  count(*) as total,
  count(*) filter (where result = 'win') as wins,
  count(*) filter (where result = 'lose') as losses,
  round(avg(coalesce(value_score, 0)), 2) as avg_value_score
from public.tips
where ai_source = 'real_ai_engine'
group by 1
order by 1;

-- 8. Recent form chips
create view public.ai_recent_form as
select
  result,
  created_at,
  match_name
from public.tips
where ai_source = 'real_ai_engine'
order by created_at desc
limit 20;

-- 9. League performance table
create view public.ai_stats_by_league as
select
  coalesce(league_name, league, 'Unknown') as league,
  count(*) as picks,
  round(
    case
      when count(*) filter (where result in ('win','lose')) > 0
      then (count(*) filter (where result = 'win')::numeric / count(*) filter (where result in ('win','lose'))::numeric) * 100
      else 0
    end, 2
  ) as winrate,
  round(coalesce(sum(profit), 0), 2) as profit,
  round(
    case
      when count(*) filter (where result in ('win','lose')) > 0
      then (coalesce(sum(profit), 0) / count(*) filter (where result in ('win','lose'))::numeric) * 100
      else 0
    end, 2
  ) as roi
from public.tips
where ai_source = 'real_ai_engine'
group by coalesce(league_name, league, 'Unknown')
order by picks desc, winrate desc;

-- 10. Simple streak summary
create view public.ai_streak as
with ordered as (
  select
    result,
    created_at,
    row_number() over (order by created_at desc) as rn
  from public.tips
  where ai_source = 'real_ai_engine'
)
select
  count(*) filter (where result = 'win') as total_wins,
  count(*) filter (where result = 'lose') as total_losses,
  count(*) filter (where result = 'pending' or result is null) as total_pending,
  round(avg(nullif(ai_confidence, 0)), 2) as average_confidence
from public.tips
where ai_source = 'real_ai_engine';

-- 11. Run log table
create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  status text default 'pending',
  source text default 'odds_api_real_v138',
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

-- 12. Read access for app
alter table public.tips enable row level security;

drop policy if exists "ai_dashboard_public_read" on public.tips;
create policy "ai_dashboard_public_read"
on public.tips
for select
using (true);

-- 13. Reload Supabase/PostgREST schema cache
NOTIFY pgrst, 'reload schema';
