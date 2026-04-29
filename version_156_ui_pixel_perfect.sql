-- VERSION 151 — KILLER VALUE FILTER + TOP VALUE + QUALITY BADGES
-- Cel: nie pokazywać/nie zapisywać słabych typów. Zostają tylko mocne value bety.

-- 1. Kolumny pod filtr jakości i realną analizę value
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists implied_probability numeric;
alter table public.tips add column if not exists quality_label text;
alter table public.tips add column if not exists risk_level text;
alter table public.tips add column if not exists ai_model_version text;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists kickoff_time timestamp;

-- 2. Wylicz quality label dla istniejących realnych typów
update public.tips
set quality_label = case
  when coalesce(value_score,0) >= 12 and coalesce(model_probability, probability, ai_confidence, 0) >= 68 then 'DIAMOND'
  when coalesce(value_score,0) >= 8 then 'HOT VALUE'
  when coalesce(value_score,0) >= 5 then 'VALUE'
  else 'LOW'
end
where ai_source = 'real_ai_engine';

-- 3. Widok TOP VALUE — tylko mocne, nierozliczone typy
create or replace view public.ai_top_value_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('live','pending')
  and coalesce(value_score,0) >= 5
  and coalesce(model_probability, probability, ai_confidence, 0) >= 60
  and coalesce(odds,0) >= 1.35
order by coalesce(value_score,0) desc,
         coalesce(model_probability, probability, ai_confidence, 0) desc,
         kickoff_time asc;

-- 4. LIVE mocne value
create or replace view public.ai_live_value_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'live'
  and coalesce(value_score,0) >= 5
  and coalesce(model_probability, probability, ai_confidence, 0) >= 60
  and coalesce(odds,0) >= 1.35
order by coalesce(value_score,0) desc, created_at desc;

-- 5. PRE mocne value
create or replace view public.ai_pre_value_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
  and coalesce(value_score,0) >= 5
  and coalesce(model_probability, probability, ai_confidence, 0) >= 60
  and coalesce(odds,0) >= 1.35
order by coalesce(value_score,0) desc, kickoff_time asc;

-- 6. Ranking lig — tylko rozliczone realne typy
create or replace view public.ai_league_ranking_value as
select
  coalesce(league_name, league, 'Unknown') as league_name,
  count(*) as settled_picks,
  count(*) filter (where status = 'won' or result = 'win') as wins,
  count(*) filter (where status = 'lost' or result = 'loss') as losses,
  round((count(*) filter (where status = 'won' or result = 'win')::numeric / nullif(count(*) filter (where status in ('won','lost') or result in ('win','loss')),0)) * 100, 2) as winrate,
  round(avg(coalesce(value_score,0)),2) as avg_value,
  round(sum(case when status = 'won' or result = 'win' then coalesce(odds,0)-1 when status = 'lost' or result = 'loss' then -1 else 0 end),2) as profit_units,
  round((sum(case when status = 'won' or result = 'win' then coalesce(odds,0)-1 when status = 'lost' or result = 'loss' then -1 else 0 end) / nullif(count(*) filter (where status in ('won','lost') or result in ('win','loss')),0)) * 100,2) as roi_percent
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and (status in ('won','lost','void') or result in ('win','loss','void'))
group by coalesce(league_name, league, 'Unknown')
order by roi_percent desc nulls last, settled_picks desc;

-- 7. Najlepsze strategie / rynki
create or replace view public.ai_strategy_ranking_value as
select
  coalesce(market, bet_type, 'AI') as market,
  coalesce(selection, pick, prediction, 'AI Pick') as selection,
  count(*) as settled_picks,
  count(*) filter (where status = 'won' or result = 'win') as wins,
  count(*) filter (where status = 'lost' or result = 'loss') as losses,
  round((count(*) filter (where status = 'won' or result = 'win')::numeric / nullif(count(*) filter (where status in ('won','lost') or result in ('win','loss')),0)) * 100, 2) as winrate,
  round(avg(coalesce(value_score,0)),2) as avg_value,
  round(sum(case when status = 'won' or result = 'win' then coalesce(odds,0)-1 when status = 'lost' or result = 'loss' then -1 else 0 end),2) as profit_units
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and (status in ('won','lost','void') or result in ('win','loss','void'))
group by coalesce(market, bet_type, 'AI'), coalesce(selection, pick, prediction, 'AI Pick')
order by profit_units desc nulls last, winrate desc nulls last;

-- 8. Indeksy
create index if not exists idx_tips_real_value_v151 on public.tips(ai_source, source, status, value_score desc);
create index if not exists idx_tips_probability_v151 on public.tips(model_probability, probability);
create index if not exists idx_tips_quality_v151 on public.tips(quality_label);

notify pgrst, 'reload schema';
