-- BET+AI 743 — statystyki AI + rozliczanie wyników
-- Wklej w Supabase -> SQL Editor -> Run.
-- Działa z darmowym APISPORTS_KEY. Nie wymaga OpenAI ani The Odds API.

create extension if not exists pgcrypto;

alter table public.tips
  add column if not exists settled_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists sport_key text,
  add column if not exists ai_score numeric,
  add column if not exists value_score numeric,
  add column if not exists model_probability numeric,
  add column if not exists implied_probability numeric,
  add column if not exists risk_level text,
  add column if not exists external_fixture_id bigint,
  add column if not exists event_time timestamptz,
  add column if not exists kickoff_time timestamptz,
  add column if not exists market text,
  add column if not exists selection text,
  add column if not exists pick text,
  add column if not exists profit numeric not null default 0,
  add column if not exists stake numeric not null default 100,
  add column if not exists live_score_home numeric not null default 0,
  add column if not exists live_score_away numeric not null default 0,
  add column if not exists live_status text;

-- Luźniejszy status, żeby live/pending/wyniki nie były blokowane przez stare CHECK.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.tips'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.tips drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.tips
  add constraint tips_status_check_v743
  check (status is null or status in ('pending','live','won','lost','void','cancelled','postponed','finished'));

update public.tips
set
  stake = coalesce(stake, 100),
  profit = coalesce(profit, 0),
  result = coalesce(nullif(result, ''), case when status in ('won','lost','void') then status else 'pending' end)
where true;

create index if not exists idx_tips_ai_model_v743 on public.tips (ai_source, source, created_at desc);
create index if not exists idx_tips_ai_result_v743 on public.tips (status, result, settled_at desc);
create index if not exists idx_tips_ai_league_v743 on public.tips (league, sport, created_at desc);
create index if not exists idx_tips_ai_fixture_v743 on public.tips (external_fixture_id);

create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  source text,
  status text,
  picks_created integer default 0,
  message text
);

create or replace view public.v_ai_model_results as
select
  id,
  created_at,
  settled_at,
  coalesce(sport, 'Inne') as sport,
  coalesce(league, league_name, 'Inne') as league,
  coalesce(market, bet_type, 'Typ AI') as bet_type,
  coalesce(selection, pick, prediction, '') as prediction,
  coalesce(team_home, split_part(match_name, ' vs ', 1), '') as home_team,
  coalesce(team_away, nullif(split_part(match_name, ' vs ', 2), ''), '') as away_team,
  coalesce(odds, 1.0) as odds,
  coalesce(stake, 100) as stake,
  coalesce(profit, 0) as profit,
  status,
  result,
  coalesce(ai_score, ai_confidence, 0) as ai_score,
  coalesce(value_score, 0) as ev,
  coalesce(model_probability, probability, ai_probability, 0) as model_probability
from public.tips
where ai_source = 'real_ai_engine' or source = 'live_ai_engine';

create or replace view public.v_ai_model_stats_by_sport as
select
  sport,
  count(*) as total_bets,
  count(*) filter (where status in ('won','lost','void')) as settled_bets,
  count(*) filter (where status = 'won') as won,
  count(*) filter (where status = 'lost') as lost,
  count(*) filter (where status = 'void') as void,
  round(100.0 * count(*) filter (where status = 'won') / nullif(count(*) filter (where status in ('won','lost')), 0), 2) as hit_rate,
  round(sum(profit), 2) as profit,
  round(100.0 * sum(profit) / nullif(sum(stake) filter (where status in ('won','lost','void')), 0), 2) as roi,
  round(avg(odds), 2) as avg_odds,
  round(avg(ai_score), 2) as avg_ai_score
from public.v_ai_model_results
group by sport
order by profit desc nulls last;

create or replace view public.v_ai_model_stats_by_league as
select
  sport,
  league,
  count(*) as total_bets,
  count(*) filter (where status in ('won','lost','void')) as settled_bets,
  count(*) filter (where status = 'won') as won,
  count(*) filter (where status = 'lost') as lost,
  round(100.0 * count(*) filter (where status = 'won') / nullif(count(*) filter (where status in ('won','lost')), 0), 2) as hit_rate,
  round(sum(profit), 2) as profit,
  round(100.0 * sum(profit) / nullif(sum(stake) filter (where status in ('won','lost','void')), 0), 2) as roi,
  round(avg(odds), 2) as avg_odds,
  round(avg(ai_score), 2) as avg_ai_score
from public.v_ai_model_results
group by sport, league
order by profit desc nulls last;

create or replace view public.v_ai_model_stats_by_bet_type as
select
  bet_type,
  count(*) as total_bets,
  count(*) filter (where status in ('won','lost','void')) as settled_bets,
  count(*) filter (where status = 'won') as won,
  count(*) filter (where status = 'lost') as lost,
  round(100.0 * count(*) filter (where status = 'won') / nullif(count(*) filter (where status in ('won','lost')), 0), 2) as hit_rate,
  round(sum(profit), 2) as profit,
  round(100.0 * sum(profit) / nullif(sum(stake) filter (where status in ('won','lost','void')), 0), 2) as roi,
  round(avg(odds), 2) as avg_odds,
  round(avg(ai_score), 2) as avg_ai_score
from public.v_ai_model_results
group by bet_type
order by profit desc nulls last;

grant select on public.v_ai_model_results to anon, authenticated;
grant select on public.v_ai_model_stats_by_sport to anon, authenticated;
grant select on public.v_ai_model_stats_by_league to anon, authenticated;
grant select on public.v_ai_model_stats_by_bet_type to anon, authenticated;

alter table public.tips enable row level security;
alter table public.ai_pick_runs enable row level security;

drop policy if exists "tips select all v743" on public.tips;
create policy "tips select all v743" on public.tips for select to anon, authenticated using (true);

drop policy if exists "tips insert all v743" on public.tips;
create policy "tips insert all v743" on public.tips for insert to anon, authenticated with check (true);

drop policy if exists "tips update all v743" on public.tips;
create policy "tips update all v743" on public.tips for update to anon, authenticated using (true) with check (true);

drop policy if exists "ai runs select v743" on public.ai_pick_runs;
create policy "ai runs select v743" on public.ai_pick_runs for select to anon, authenticated using (true);
