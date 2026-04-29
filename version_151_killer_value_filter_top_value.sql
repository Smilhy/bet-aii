-- VERSION 147 — REAL AI PRE/LIVE SCHEMA FIX + NO RANDOM TRIGGER
-- Fixuje błąd: record "new" has no field "confidence"
-- oraz wyłącza stary trigger z wersji 146, który nadpisywał realne typy PRE losowymi danymi.

-- =========================
-- 1. BRAKUJĄCE KOLUMNY POD REAL AI ENGINE
-- =========================
alter table public.tips add column if not exists external_fixture_id text;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists pick text;
alter table public.tips add column if not exists odds numeric default 1;
alter table public.tips add column if not exists implied_probability numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists risk_level text;
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists live_minute integer default 0;
alter table public.tips add column if not exists live_score_home integer default 0;
alter table public.tips add column if not exists live_score_away integer default 0;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric default 0;

-- =========================
-- 2. WYŁĄCZ STARY RANDOM/FALLBACK Z V146
-- =========================
drop trigger if exists trg_generate_pre_logic on public.tips;
drop function if exists public.generate_pre_match_logic();

-- =========================
-- 3. STATUSY
-- =========================
alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check
check (status in ('pending','live','won','lost','void'));

alter table public.tips alter column status set default 'pending';

-- =========================
-- 4. UNIKALNOŚĆ MECZU Z API-FOOTBALL
-- =========================
drop index if exists idx_unique_fixture;
create unique index if not exists idx_unique_real_fixture_v147
on public.tips(external_fixture_id)
where external_fixture_id is not null and ai_source = 'real_ai_engine' and source = 'live_ai_engine';

-- =========================
-- 5. AUTO LIGI — DOPISUJE BRAKUJĄCE LIGI
-- =========================
create table if not exists public.leagues (
  id bigserial primary key,
  league_id integer unique,
  name text,
  country text,
  created_at timestamptz default now()
);

alter table public.tips add column if not exists league_id integer;

create or replace function public.auto_insert_league_v147()
returns trigger as $$
begin
  if new.league_id is not null then
    insert into public.leagues (league_id, name, country)
    values (new.league_id, coalesce(new.league_name, new.league), new.country)
    on conflict (league_id) do update set
      name = coalesce(excluded.name, public.leagues.name),
      country = coalesce(excluded.country, public.leagues.country);
  elsif coalesce(new.league_name, new.league) is not null then
    insert into public.leagues (league_id, name, country)
    values (null, coalesce(new.league_name, new.league), new.country)
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_league on public.tips;
drop trigger if exists trg_auto_league_v147 on public.tips;
create trigger trg_auto_league_v147
after insert on public.tips
for each row execute function public.auto_insert_league_v147();

-- =========================
-- 6. REALNE WIDOKI LIVE / PRE
-- =========================
create or replace view public.ai_live_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'live'
order by created_at desc;

create or replace view public.ai_pre_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
order by coalesce(kickoff_time, event_time, match_time, created_at) asc;

create or replace view public.ai_real_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('live','pending')
order by
  case when status = 'live' then 0 else 1 end,
  coalesce(kickoff_time, event_time, match_time, created_at) asc;

-- =========================
-- 7. STATYSTYKI REAL AI
-- =========================
create or replace view public.ai_stats as
select
  count(*) filter (where status = 'won') as wins,
  count(*) filter (where status = 'lost') as losses,
  count(*) filter (where status = 'void') as voids,
  count(*) filter (where status = 'pending') as pending,
  count(*) filter (where status = 'live') as live,
  count(*) as total,
  round((count(*) filter (where status = 'won')::numeric / nullif(count(*) filter (where status in ('won','lost')),0)) * 100, 2) as winrate
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine';

-- =========================
-- 8. INDEXY
-- =========================
create index if not exists idx_real_ai_feed_v147 on public.tips(ai_source, source, status);
create index if not exists idx_real_ai_kickoff_v147 on public.tips(kickoff_time);
create index if not exists idx_real_ai_confidence_v147 on public.tips(ai_confidence);

-- =========================
-- 9. REFRESH SUPABASE CACHE
-- =========================
notify pgrst, 'reload schema';
