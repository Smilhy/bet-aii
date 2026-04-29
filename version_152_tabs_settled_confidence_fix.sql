-- VERSION 150 — DASHBOARD STATYSTYK PRO + ZAKOŃCZONE/ROZLICZONE

-- 1. Kolumny potrzebne do poprawnego zapisu wyników i rozliczeń
alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists kickoff_time timestamp;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists final_score_home integer;
alter table public.tips add column if not exists final_score_away integer;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists settled_at timestamp;
alter table public.tips add column if not exists settlement_note text;

-- 2. Statusy dla LIVE / PRE / rozliczeń
alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check
check (status in ('pending','live','won','lost','void'));

-- 3. Widok LIVE — tylko mecze trwające
create or replace view public.ai_live_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'live'
  and coalesce(live_status,'') not in ('NS','FT')
order by coalesce(live_minute,0) desc, kickoff_time desc;

-- 4. Widok PRE — tylko mecze przed startem
create or replace view public.ai_pre_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
order by kickoff_time asc;

-- 5. Widok zakończone / rozliczone
create or replace view public.ai_settled_matches as
select *,
  case
    when status = 'won' then 'WYGRANA'
    when status = 'lost' then 'PRZEGRANA'
    when status = 'void' then 'ZWROT'
    else 'NIEROZLICZONE'
  end as settlement_label,
  case
    when status = 'won' then '✅'
    when status = 'lost' then '❌'
    when status = 'void' then '↩️'
    else '⏳'
  end as settlement_icon
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
order by coalesce(settled_at, created_at) desc;

-- 6. Dashboard PRO — główne statystyki
create or replace view public.ai_dashboard_pro_stats as
select
  count(*) filter (where status = 'live') as live_count,
  count(*) filter (where status = 'pending') as pre_count,
  count(*) filter (where status in ('won','lost','void')) as settled_count,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate,
  round(coalesce(sum(profit) filter (where status in ('won','lost','void')),0), 2) as profit,
  round((coalesce(sum(profit) filter (where status in ('won','lost','void')),0) / nullif(count(*) filter (where status in ('won','lost','void')) * 100,0)) * 100, 2) as roi
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine';

-- 7. Statystyki po ligach
create or replace view public.ai_stats_by_league as
select
  coalesce(league_name, league, 'Unknown') as league_name,
  count(*) filter (where status in ('won','lost','void')) as settled,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate,
  round(coalesce(sum(profit),0), 2) as profit,
  round((coalesce(sum(profit),0) / nullif(count(*) filter (where status in ('won','lost','void')) * 100,0)) * 100, 2) as roi
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
group by coalesce(league_name, league, 'Unknown')
order by profit desc;

-- 8. Statystyki po rynkach
create or replace view public.ai_stats_by_market as
select
  coalesce(market, bet_type, type, 'AI') as market,
  count(*) filter (where status in ('won','lost','void')) as settled,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate,
  round(coalesce(sum(profit),0), 2) as profit,
  round((coalesce(sum(profit),0) / nullif(count(*) filter (where status in ('won','lost','void')) * 100,0)) * 100, 2) as roi
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
group by coalesce(market, bet_type, type, 'AI')
order by profit desc;

-- 9. Indexy
create index if not exists idx_ai_tabs_v150 on public.tips(ai_source, source, status, kickoff_time);
create index if not exists idx_ai_settled_v150 on public.tips(status, settled_at) where ai_source = 'real_ai_engine' and source = 'live_ai_engine';
create unique index if not exists idx_unique_fixture_v150 on public.tips(external_fixture_id) where external_fixture_id is not null;

-- 10. Supabase/PostgREST schema cache
notify pgrst, 'reload schema';
