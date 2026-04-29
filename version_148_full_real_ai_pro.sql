-- VERSION 144 — ONLY REAL MATCHES + AUTO LEAGUES + SETTLEMENT/STATS FOUNDATION

-- Required columns for real API-Football matches.
alter table public.tips add column if not exists external_fixture_id text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists settled_at timestamptz;

-- LIVE status is valid while match is running; settlement changes it to won/lost/void.
alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check
check (status in ('pending','live','won','lost','void','win','loss'));

-- Remove fake/manual AI rubbish from the AI screen data source.
delete from public.tips
where ai_source is null
   or ai_source <> 'real_ai_engine'
   or source is null
   or source <> 'live_ai_engine';

-- Auto league catalog: every inserted real match keeps missing leagues saved.
create table if not exists public.league_catalog (
  id bigserial primary key,
  league_name text not null,
  country text,
  sport text default 'football',
  source text default 'api_football',
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create unique index if not exists league_catalog_unique_v144
on public.league_catalog (league_name, coalesce(country, ''), sport);

create or replace function public.sync_real_match_league_catalog()
returns trigger
language plpgsql
as $$
begin
  if new.ai_source = 'real_ai_engine' and new.source = 'live_ai_engine' then
    insert into public.league_catalog (league_name, country, sport, source, last_seen_at)
    values (coalesce(new.league_name, new.league, 'Unknown League'), new.country, coalesce(new.sport, 'football'), 'api_football', now())
    on conflict (league_name, coalesce(country, ''), sport)
    do update set last_seen_at = excluded.last_seen_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_real_match_league_catalog on public.tips;
create trigger trg_sync_real_match_league_catalog
after insert or update of league_name, league, country, sport, ai_source, source on public.tips
for each row execute function public.sync_real_match_league_catalog();

-- Backfill leagues already saved.
insert into public.league_catalog (league_name, country, sport, source, last_seen_at)
select distinct coalesce(league_name, league, 'Unknown League'), country, coalesce(sport, 'football'), 'api_football', now()
from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine'
on conflict (league_name, coalesce(country, ''), sport)
do update set last_seen_at = excluded.last_seen_at;

-- Clean views for frontend: only real matches, never fake generator picks.
drop view if exists public.ai_events_feed cascade;
drop view if exists public.ai_live_events_feed cascade;
drop view if exists public.ai_real_matches cascade;
drop view if exists public.ai_live_only cascade;
drop view if exists public.ai_upcoming_only cascade;
drop view if exists public.ai_real_stats_by_league cascade;
drop view if exists public.ai_real_stats_global cascade;

create view public.ai_real_matches as
select * from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status in ('pending','live','won','lost','void','win','loss')
order by
  case when status = 'live' then 0 when status = 'pending' then 1 else 2 end,
  coalesce(kickoff_time, event_time, match_time, created_at) asc;

create view public.ai_live_only as
select * from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and (status = 'live' or (live_status is not null and upper(live_status) <> 'NS'))
order by created_at desc;

create view public.ai_upcoming_only as
select * from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
  and coalesce(upper(live_status), 'NS') = 'NS'
order by coalesce(kickoff_time, event_time, match_time, created_at) asc;

create view public.ai_real_stats_global as
select
  count(*) filter (where ai_source = 'real_ai_engine' and source = 'live_ai_engine') as total_real_picks,
  count(*) filter (where status = 'live') as live_now,
  count(*) filter (where status = 'pending') as upcoming_or_pending,
  count(*) filter (where status in ('won','win')) as wins,
  count(*) filter (where status in ('lost','loss')) as losses,
  count(*) filter (where status = 'void') as voids,
  coalesce(sum(profit),0) as total_profit,
  case when count(*) filter (where status in ('won','win','lost','loss')) > 0
    then round((count(*) filter (where status in ('won','win'))::numeric / count(*) filter (where status in ('won','win','lost','loss'))::numeric) * 100, 2)
    else 0 end as win_rate,
  case when count(*) filter (where status in ('won','win','lost','loss','void')) > 0
    then round((coalesce(sum(profit),0)::numeric / (count(*) filter (where status in ('won','win','lost','loss','void')) * 100)::numeric) * 100, 2)
    else 0 end as roi
from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine';

create view public.ai_real_stats_by_league as
select
  coalesce(league_name, league, 'Unknown League') as league_name,
  country,
  count(*) as picks,
  count(*) filter (where status in ('won','win')) as wins,
  count(*) filter (where status in ('lost','loss')) as losses,
  count(*) filter (where status = 'void') as voids,
  coalesce(sum(profit),0) as profit,
  case when count(*) filter (where status in ('won','win','lost','loss')) > 0
    then round((count(*) filter (where status in ('won','win'))::numeric / count(*) filter (where status in ('won','win','lost','loss'))::numeric) * 100, 2)
    else 0 end as win_rate
from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine'
group by coalesce(league_name, league, 'Unknown League'), country
order by picks desc, profit desc;

create index if not exists idx_tips_real_engine_v144 on public.tips(ai_source, source, status);
create index if not exists idx_tips_external_fixture_v144 on public.tips(external_fixture_id);
create index if not exists idx_tips_real_kickoff_v144 on public.tips(kickoff_time);

notify pgrst, 'reload schema';
