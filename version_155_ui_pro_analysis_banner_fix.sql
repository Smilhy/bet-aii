-- VERSION 152 — FINAL TABS + SETTLED VIEW + CONFIDENCE SCHEMA FIX
-- Uruchom w Supabase SQL Editor po deployu paczki v152.

-- 1) Kolumny wymagane przez REAL AI PRO / LIVE / PRE / SETTLED
alter table public.tips add column if not exists confidence numeric;
alter table public.tips add column if not exists ai_confidence numeric;
alter table public.tips add column if not exists ai_score numeric;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists implied_probability numeric;
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists quality text;
alter table public.tips add column if not exists quality_label text;
alter table public.tips add column if not exists is_top_value boolean default false;
alter table public.tips add column if not exists risk_level text;
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists pick text;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists settled_at timestamp;
alter table public.tips add column if not exists updated_at timestamp;

alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists external_home_team_id bigint;
alter table public.tips add column if not exists external_away_team_id bigint;
alter table public.tips add column if not exists league_id integer;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists kickoff_time timestamp;
alter table public.tips add column if not exists match_time timestamp;
alter table public.tips add column if not exists event_time timestamp;
alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'real_ai_engine';
alter table public.tips add column if not exists source text default 'live_ai_engine';
alter table public.tips add column if not exists ai_model_version text;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists form_home_score numeric;
alter table public.tips add column if not exists form_away_score numeric;
alter table public.tips add column if not exists h2h_over25_rate numeric;
alter table public.tips add column if not exists h2h_btts_rate numeric;
alter table public.tips add column if not exists xg_home numeric;
alter table public.tips add column if not exists xg_away numeric;
alter table public.tips add column if not exists shots_home numeric;
alter table public.tips add column if not exists shots_away numeric;

-- 2) Statusy
alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check
check (status in ('pending','live','won','lost','void'));

-- 3) Usuń stare triggery/funkcje, które powodowały błąd: record NEW has no field confidence
--    Potem tworzymy jedną bezpieczną funkcję.
drop trigger if exists trg_generate_pre_logic on public.tips;
drop function if exists public.generate_pre_match_logic();
drop trigger if exists trg_real_ai_score on public.tips;
drop function if exists public.real_ai_score();
drop trigger if exists trg_quality_value on public.tips;
drop trigger if exists trg_block_weak on public.tips;
drop trigger if exists trg_limit_top on public.tips;

drop function if exists public.assign_quality_and_value();
drop function if exists public.block_weak_tips();
drop function if exists public.limit_top_value_daily();

create or replace function public.assign_quality_and_value()
returns trigger as $$
begin
  -- synchronizacja confidence
  if new.confidence is null then
    new.confidence := coalesce(new.ai_confidence, new.model_probability, new.probability, 0);
  end if;
  if new.ai_confidence is null then
    new.ai_confidence := coalesce(new.confidence, new.model_probability, new.probability, 0);
  end if;

  -- value score
  if new.value_score is null and coalesce(new.probability, new.model_probability, new.confidence) is not null and new.odds is not null then
    new.value_score := round(((coalesce(new.probability, new.model_probability, new.confidence) / 100.0) * new.odds - 1) * 100, 2);
  end if;

  -- jakość
  if coalesce(new.value_score, 0) >= 15 then
    new.quality := '💎';
    new.quality_label := 'DIAMOND';
    new.is_top_value := true;
  elsif coalesce(new.value_score, 0) >= 10 then
    new.quality := '🔥';
    new.quality_label := 'HOT VALUE';
    new.is_top_value := true;
  elsif coalesce(new.value_score, 0) >= 5 then
    new.quality := '⭐';
    new.quality_label := 'VALUE';
    new.is_top_value := true;
  else
    new.quality := '❌';
    new.quality_label := 'WEAK';
    new.is_top_value := false;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_quality_value
before insert or update on public.tips
for each row execute function public.assign_quality_and_value();

-- 4) Widoki do zakładek: TOP VALUE / LIVE / ZARAZ STARTUJĄ / ZAKOŃCZONE
create or replace view public.ai_top_value as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and is_top_value = true
  and status in ('pending','live')
order by value_score desc nulls last, model_probability desc nulls last, created_at desc;

create or replace view public.ai_live_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'live'
order by live_minute desc nulls last, created_at desc;

create or replace view public.ai_pre_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
order by kickoff_time asc nulls last, created_at desc;

create or replace view public.ai_settled_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
order by settled_at desc nulls last, kickoff_time desc nulls last, created_at desc;

create or replace view public.ai_all_real_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
order by
  case when status = 'live' then 0 when status = 'pending' then 1 else 2 end,
  kickoff_time asc nulls last,
  created_at desc;

-- 5) Statystyki PRO
create or replace view public.ai_stats_pro as
select
  count(*) filter (where status = 'live') as live_count,
  count(*) filter (where status = 'pending') as pre_count,
  count(*) filter (where status in ('won','lost','void')) as settled_count,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  coalesce(sum(profit) filter (where status in ('won','lost','void')), 0) as profit,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')), 0)) * 100, 2) as winrate,
  round((coalesce(sum(profit) filter (where status in ('won','lost','void')), 0)::numeric / nullif(count(*) filter (where status in ('won','lost','void')) * 100, 0)) * 100, 2) as roi
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine';

create or replace view public.ai_league_ranking as
select
  league_name,
  count(*) as picks,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  coalesce(sum(profit),0) as profit,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
group by league_name
order by profit desc, winrate desc nulls last;

create or replace view public.ai_strategy_ranking as
select
  market,
  count(*) as picks,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  coalesce(sum(profit),0) as profit,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
group by market
order by profit desc, winrate desc nulls last;

-- 6) Indeksy
create unique index if not exists idx_unique_real_fixture_v152 on public.tips(external_fixture_id) where external_fixture_id is not null;
create index if not exists idx_ai_real_status_v152 on public.tips(ai_source, source, status);
create index if not exists idx_ai_top_value_v152 on public.tips(is_top_value, value_score desc);
create index if not exists idx_ai_settled_v152 on public.tips(settled_at desc) where status in ('won','lost','void');

-- 7) Cache Supabase/PostgREST
notify pgrst, 'reload schema';
