-- VERSION 149 — AUTO SETTLEMENT STEP + REAL AI STATS
-- Krok 1: rozliczanie FT, poprawne statusy won/lost/void, statystyki i widoki wyników.

alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists settled_at timestamp with time zone;
alter table public.tips add column if not exists live_score_home integer default 0;
alter table public.tips add column if not exists live_score_away integer default 0;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'real_ai_engine';
alter table public.tips add column if not exists source text default 'live_ai_engine';
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists ai_confidence numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists implied_probability numeric;

alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check
check (status in ('pending','live','won','lost','void'));

alter table public.tips drop constraint if exists tips_result_check;
alter table public.tips add constraint tips_result_check
check (result in ('pending','live','win','loss','void'));

-- Napraw stare rekordy, jeśli wcześniejsza funkcja próbowała zapisać status win/loss.
update public.tips set status = 'won' where status = 'win';
update public.tips set status = 'lost' where status = 'loss';
update public.tips set result = 'win' where status = 'won' and coalesce(result,'pending') not in ('win','loss','void');
update public.tips set result = 'loss' where status = 'lost' and coalesce(result,'pending') not in ('win','loss','void');
update public.tips set result = 'void' where status = 'void' and coalesce(result,'pending') not in ('win','loss','void');

-- Zysk liczony na stake 100 PLN, żeby dashboard miał stałą bazę.
create or replace function public.recalculate_real_ai_profit()
returns trigger as $$
begin
  if new.status = 'won' then
    new.result := 'win';
    new.profit := round((coalesce(new.odds, 0) - 1) * 100, 2);
    new.settled_at := coalesce(new.settled_at, now());
  elsif new.status = 'lost' then
    new.result := 'loss';
    new.profit := -100;
    new.settled_at := coalesce(new.settled_at, now());
  elsif new.status = 'void' then
    new.result := 'void';
    new.profit := 0;
    new.settled_at := coalesce(new.settled_at, now());
  elsif new.status = 'live' then
    new.result := 'live';
  else
    new.result := 'pending';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_recalculate_real_ai_profit on public.tips;
create trigger trg_recalculate_real_ai_profit
before insert or update of status, odds on public.tips
for each row execute function public.recalculate_real_ai_profit();

create index if not exists idx_tips_real_ai_settlement_v149 on public.tips(ai_source, source, status, settled_at);
create index if not exists idx_tips_real_ai_fixture_v149 on public.tips(external_fixture_id) where external_fixture_id is not null;
create index if not exists idx_tips_real_ai_market_v149 on public.tips(market);

create or replace view public.ai_settled_picks as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('won','lost','void')
order by settled_at desc nulls last, created_at desc;

create or replace view public.ai_open_picks as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('pending','live')
order by case when status = 'live' then 0 else 1 end, kickoff_time asc nulls last, created_at desc;

create or replace view public.ai_stats_v149 as
select
  count(*) as total_picks,
  count(*) filter (where status = 'live') as live_picks,
  count(*) filter (where status = 'pending') as pre_picks,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  count(*) filter (where status in ('won','lost','void')) as settled_picks,
  round(sum(coalesce(profit,0)), 2) as profit,
  round((sum(coalesce(profit,0)) / nullif(count(*) filter (where status in ('won','lost')) * 100, 0)) * 100, 2) as roi_percent,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate,
  round(avg(ai_confidence), 2) as avg_confidence,
  round(avg(value_score), 2) as avg_value_score
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine';

create or replace view public.ai_market_stats_v149 as
select
  coalesce(market, selection, pick, 'unknown') as market,
  count(*) as picks,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  round(sum(coalesce(profit,0)), 2) as profit,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate,
  round((sum(coalesce(profit,0)) / nullif(count(*) filter (where status in ('won','lost')) * 100, 0)) * 100, 2) as roi_percent
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
group by 1
order by profit desc nulls last, picks desc;

create or replace view public.ai_league_stats_v149 as
select
  coalesce(league_name, league, 'Unknown') as league,
  coalesce(country, '') as country,
  count(*) as picks,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  round(sum(coalesce(profit,0)), 2) as profit,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate,
  round((sum(coalesce(profit,0)) / nullif(count(*) filter (where status in ('won','lost')) * 100, 0)) * 100, 2) as roi_percent
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
group by 1,2
order by profit desc nulls last, picks desc;

notify pgrst, 'reload schema';
