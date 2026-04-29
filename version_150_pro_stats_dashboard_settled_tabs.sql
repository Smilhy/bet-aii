-- VERSION 148 — FULL REAL AI PRO
-- Realne LIVE/PRE + forma drużyn + H2H + xG-proxy + value bet + brak random triggerów

alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists external_home_team_id bigint;
alter table public.tips add column if not exists external_away_team_id bigint;
alter table public.tips add column if not exists league_id integer;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists kickoff_time timestamp with time zone;
alter table public.tips add column if not exists match_time timestamp with time zone;
alter table public.tips add column if not exists event_time timestamp with time zone;
alter table public.tips add column if not exists live_minute integer default 0;
alter table public.tips add column if not exists live_score_home integer default 0;
alter table public.tips add column if not exists live_score_away integer default 0;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'real_ai_engine';
alter table public.tips add column if not exists source text default 'live_ai_engine';
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists implied_probability numeric;
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists ai_confidence numeric;
alter table public.tips add column if not exists ai_score numeric;
alter table public.tips add column if not exists risk_level text;
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists ai_model_version text;
alter table public.tips add column if not exists form_home_score numeric;
alter table public.tips add column if not exists form_away_score numeric;
alter table public.tips add column if not exists h2h_over25_rate numeric;
alter table public.tips add column if not exists h2h_btts_rate numeric;
alter table public.tips add column if not exists xg_home numeric;
alter table public.tips add column if not exists xg_away numeric;
alter table public.tips add column if not exists shots_home numeric;
alter table public.tips add column if not exists shots_away numeric;
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists result text default 'pending';

-- Usuń stare losowe triggery PRE z wersji 146/147
drop trigger if exists trg_generate_pre_logic on public.tips;
drop function if exists public.generate_pre_match_logic();

alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check
check (status in ('pending','live','won','lost','void'));

create table if not exists public.leagues (
  id bigserial primary key,
  league_id integer unique,
  name text,
  country text,
  created_at timestamp with time zone default now()
);

create or replace function public.auto_insert_league()
returns trigger as $$
begin
  if new.league_id is not null then
    insert into public.leagues (league_id, name, country)
    values (new.league_id, coalesce(new.league_name, new.league), new.country)
    on conflict (league_id) do update set
      name = coalesce(excluded.name, public.leagues.name),
      country = coalesce(excluded.country, public.leagues.country);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_league on public.tips;
create trigger trg_auto_league
after insert or update of league_id, league_name, league, country on public.tips
for each row execute function public.auto_insert_league();

-- Unique tylko dla realnego silnika, żeby nie blokować innych rekordów
create unique index if not exists idx_tips_external_fixture_real_ai_v148
on public.tips(external_fixture_id)
where external_fixture_id is not null and ai_source = 'real_ai_engine' and source = 'live_ai_engine';

create index if not exists idx_tips_real_ai_v148 on public.tips(ai_source, source, status);
create index if not exists idx_tips_kickoff_v148 on public.tips(kickoff_time);
create index if not exists idx_tips_value_v148 on public.tips(value_score);
create index if not exists idx_tips_model_v148 on public.tips(ai_model_version);

create or replace view public.ai_live_matches as
select * from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine' and status = 'live'
order by coalesce(value_score,0) desc, created_at desc;

create or replace view public.ai_pre_matches as
select * from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine' and status = 'pending'
order by kickoff_time asc, coalesce(value_score,0) desc;

create or replace view public.ai_real_matches as
select * from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine' and status in ('live','pending')
order by case when status = 'live' then 0 else 1 end, kickoff_time asc, coalesce(value_score,0) desc;

create or replace view public.ai_value_bets as
select id, match_name, league_name, country, status, live_status, kickoff_time, pick, market, odds,
       model_probability, implied_probability, value_score, ai_confidence, risk_level,
       form_home_score, form_away_score, h2h_over25_rate, h2h_btts_rate, xg_home, xg_away, analysis
from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine' and status in ('live','pending')
order by coalesce(value_score,0) desc, coalesce(ai_confidence,0) desc;

create or replace view public.ai_real_ai_pro_stats as
select
  count(*) as total_picks,
  count(*) filter (where status = 'live') as live_picks,
  count(*) filter (where status = 'pending') as pre_picks,
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  round(avg(ai_confidence), 2) as avg_confidence,
  round(avg(value_score), 2) as avg_value_score,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate
from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine';

notify pgrst, 'reload schema';
