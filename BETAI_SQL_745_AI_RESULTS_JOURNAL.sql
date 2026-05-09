-- BET+AI 745 — AI Journal / Mecze Result / statystyki lig i sportów
-- Wklej w Supabase -> SQL Editor -> Run.
-- Nie wymaga płatnego OpenAI ani The Odds API. Działa z darmowym APISPORTS_KEY.

create extension if not exists pgcrypto;

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.tips
  add column if not exists ai_external_key text,
  add column if not exists external_fixture_id bigint,
  add column if not exists ai_source text,
  add column if not exists source text,
  add column if not exists ai_model_version text,
  add column if not exists author_name text,
  add column if not exists username text,
  add column if not exists sport text,
  add column if not exists sport_key text,
  add column if not exists country text,
  add column if not exists league text,
  add column if not exists league_name text,
  add column if not exists match text,
  add column if not exists match_name text,
  add column if not exists team_home text,
  add column if not exists team_away text,
  add column if not exists event_time timestamptz,
  add column if not exists kickoff_time timestamptz,
  add column if not exists match_time timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists market text,
  add column if not exists bet_type text,
  add column if not exists selection text,
  add column if not exists pick text,
  add column if not exists prediction text,
  add column if not exists odds numeric,
  add column if not exists course numeric,
  add column if not exists stake numeric not null default 100,
  add column if not exists profit numeric not null default 0,
  add column if not exists implied_probability numeric,
  add column if not exists model_probability numeric,
  add column if not exists probability numeric,
  add column if not exists value_score numeric,
  add column if not exists ai_score numeric,
  add column if not exists ai_confidence numeric,
  add column if not exists ai_probability numeric,
  add column if not exists confidence numeric,
  add column if not exists risk_level text,
  add column if not exists description text,
  add column if not exists analysis text,
  add column if not exists ai_analysis text,
  add column if not exists live_score_home numeric not null default 0,
  add column if not exists live_score_away numeric not null default 0,
  add column if not exists live_status text,
  add column if not exists status text not null default 'pending',
  add column if not exists result text default 'pending',
  add column if not exists access_type text default 'free',
  add column if not exists access text default 'free',
  add column if not exists is_premium boolean not null default false,
  add column if not exists price numeric not null default 0;

-- Usuwamy stare checki statusu, które mogły blokować live/pending/finished.
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
  add constraint tips_status_check_v745
  check (status is null or status in ('pending','live','won','lost','void','cancelled','postponed','finished'));

update public.tips
set
  stake = coalesce(stake, 100),
  profit = coalesce(profit, 0),
  status = coalesce(nullif(status, ''), 'pending'),
  result = coalesce(nullif(result, ''), case when status in ('won','lost','void') then status else 'pending' end),
  ai_external_key = coalesce(nullif(ai_external_key, ''), case when external_fixture_id is not null then external_fixture_id::text else null end)
where true;

create index if not exists idx_tips_ai_journal_created_v745 on public.tips (created_at desc);
create index if not exists idx_tips_ai_journal_source_v745 on public.tips (ai_source, source, created_at desc);
create index if not exists idx_tips_ai_journal_sport_v745 on public.tips (sport, created_at desc);
create index if not exists idx_tips_ai_journal_league_v745 on public.tips (league, sport, created_at desc);
create index if not exists idx_tips_ai_journal_result_v745 on public.tips (status, result, settled_at desc);
create index if not exists idx_tips_ai_external_key_v745 on public.tips (ai_external_key);

-- Unikalność tylko dla typów AI, żeby ten sam mecz/rynek nie zapisywał się co minutę po auto-refreshu.
create unique index if not exists uniq_ai_journal_pick_v745
on public.tips (ai_external_key, market, selection)
where ai_external_key is not null and (ai_source = 'real_ai_engine' or source = 'live_ai_engine');

create or replace view public.v_ai_match_results as
select
  id,
  created_at,
  settled_at,
  coalesce(sport, sport_key, 'Sport') as sport,
  coalesce(league, league_name, country, 'Liga') as division,
  coalesce(team_home, split_part(coalesce(match_name, match, 'Home vs Away'), ' vs ', 1), 'Home') as home_team,
  coalesce(team_away, nullif(split_part(coalesce(match_name, match, 'Home vs Away'), ' vs ', 2), ''), 'Away') as away_team,
  coalesce(live_score_home, 0) as score_home,
  coalesce(live_score_away, 0) as score_away,
  coalesce(selection, pick, prediction, bet_type, market, '') as prediction,
  coalesce(odds, course, 1.80) as odds,
  coalesce(ai_score, ai_confidence, confidence, ai_probability, 0) as ai_score,
  coalesce(value_score, 0) as ev,
  status,
  result,
  coalesce(event_time, kickoff_time, match_time, created_at) as match_date,
  ai_external_key,
  external_fixture_id
from public.tips
where ai_source = 'real_ai_engine' or source = 'live_ai_engine';

create or replace view public.v_ai_stats_by_sport as
select
  sport,
  count(*) as total_bets,
  count(*) filter (where status in ('won','lost','void')) as settled_bets,
  count(*) filter (where status = 'won') as won,
  count(*) filter (where status = 'lost') as lost,
  round(100.0 * count(*) filter (where status = 'won') / nullif(count(*) filter (where status in ('won','lost')), 0), 2) as hit_rate,
  round(sum(profit), 2) as profit,
  round(100.0 * sum(profit) / nullif(sum(stake) filter (where status in ('won','lost','void')), 0), 2) as roi,
  round(avg(odds), 2) as avg_odds,
  round(avg(ai_score), 2) as avg_ai_score
from public.v_ai_match_results
group by sport
order by total_bets desc;

create or replace view public.v_ai_stats_by_league as
select
  sport,
  division as league,
  count(*) as total_bets,
  count(*) filter (where status in ('won','lost','void')) as settled_bets,
  count(*) filter (where status = 'won') as won,
  count(*) filter (where status = 'lost') as lost,
  round(100.0 * count(*) filter (where status = 'won') / nullif(count(*) filter (where status in ('won','lost')), 0), 2) as hit_rate,
  round(sum(profit), 2) as profit,
  round(100.0 * sum(profit) / nullif(sum(stake) filter (where status in ('won','lost','void')), 0), 2) as roi,
  round(avg(odds), 2) as avg_odds,
  round(avg(ai_score), 2) as avg_ai_score
from public.v_ai_match_results
group by sport, division
order by total_bets desc;

grant select on public.v_ai_match_results to anon, authenticated;
grant select on public.v_ai_stats_by_sport to anon, authenticated;
grant select on public.v_ai_stats_by_league to anon, authenticated;

alter table public.tips enable row level security;

drop policy if exists "tips select all v745" on public.tips;
create policy "tips select all v745" on public.tips for select to anon, authenticated using (true);

drop policy if exists "tips insert all v745" on public.tips;
create policy "tips insert all v745" on public.tips for insert to anon, authenticated with check (true);

drop policy if exists "tips update all v745" on public.tips;
create policy "tips update all v745" on public.tips for update to anon, authenticated using (true) with check (true);
