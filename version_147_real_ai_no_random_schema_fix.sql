-- VERSION 145 — PRE MATCHES FIX: external_fixture_id + real LIVE/soon only
-- Naprawia błąd: Could not find the 'external_fixture_id' column of 'tips' in the schema cache

-- 1. Kolumny wymagane przez skaner realnych meczów LIVE + PRE
alter table public.tips add column if not exists external_fixture_id text;
alter table public.tips add column if not exists league_id integer;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists sport text default 'football';
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists live_minute integer default 0;
alter table public.tips add column if not exists live_score_home integer default 0;
alter table public.tips add column if not exists live_score_away integer default 0;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists implied_probability numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists ai_confidence numeric;
alter table public.tips add column if not exists ai_score numeric;
alter table public.tips add column if not exists risk_level text;
alter table public.tips add column if not exists bookmaker text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric default 0;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists profit numeric default 0;

-- 2. Statusy potrzebne dla PRE/LIVE/rozliczenia
alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips
add constraint tips_status_check
check (status in ('pending','live','won','lost','void'));

alter table public.tips alter column status set default 'pending';

-- 3. Tabela lig + auto dopisywanie brakujących lig
create table if not exists public.leagues (
  id bigserial primary key,
  league_id integer unique,
  name text,
  country text,
  created_at timestamptz default now()
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

-- 4. Nie duplikuj tego samego meczu z API-Football
create unique index if not exists idx_tips_real_fixture_unique_v145
on public.tips (external_fixture_id)
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and external_fixture_id is not null
  and external_fixture_id <> '';

-- 5. Widoki: tylko realne mecze, osobno LIVE i PRE
create or replace view public.ai_real_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('live','pending')
order by
  case when status = 'live' then 0 else 1 end,
  coalesce(kickoff_time, event_time, match_time, created_at) asc;

create or replace view public.ai_live_only as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'live'
order by created_at desc;

create or replace view public.ai_upcoming_only as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
order by coalesce(kickoff_time, event_time, match_time, created_at) asc;

-- 6. Indexy pod szybkie filtrowanie
create index if not exists idx_real_matches_v145 on public.tips(ai_source, source, status);
create index if not exists idx_real_matches_time_v145 on public.tips(kickoff_time, event_time, match_time);
create index if not exists idx_real_matches_league_v145 on public.tips(league_id, league_name);

-- 7. Refresh Supabase/PostgREST schema cache
notify pgrst, 'reload schema';
