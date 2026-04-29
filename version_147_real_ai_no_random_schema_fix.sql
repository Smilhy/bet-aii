-- VERSION 142 — LIVE AI REAL MATCHES ONLY + AUTO LEAGUES
-- Pokazuje i liczy LIVE tylko z realnego API-Football; usuwa stare sztuczne/demo wpisy AI, jeśli trafiły do bazy.

alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists status text default 'pending';

-- status służy do rozliczania typu; status meczu live zostaje w live_status.
update public.tips set status = 'pending'
where lower(coalesce(status, 'pending')) not in ('pending','won','lost','void');

alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check check (status in ('pending','won','lost','void'));

-- Usunięcie typowych testowych/demo rekordów AI, jeśli zostały kiedyś zapisane do Supabase.
delete from public.tips
where ai_source = 'real_ai_engine'
  and (
    id::text like 'demo-%'
    or lower(coalesce(source,'')) in ('demo','mock','sample','fake','static')
    or lower(coalesce(author_name,'')) in ('ai tip','demo','test')
  );

create index if not exists idx_tips_live_real_v142 on public.tips(ai_source, source, live_status, created_at desc);
create index if not exists idx_tips_league_auto_v142 on public.tips(league_name, league, sport);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  sport text default 'football',
  source text default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name, sport)
);

create or replace function public.sync_league_from_tip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.league_name, new.league, '') <> '' then
    insert into public.leagues(name, country, sport, source, updated_at)
    values (
      coalesce(nullif(new.league_name, ''), new.league),
      nullif(new.country, ''),
      coalesce(nullif(new.sport, ''), 'football'),
      'auto_tip_insert',
      now()
    )
    on conflict (name, sport) do update set
      country = coalesce(excluded.country, public.leagues.country),
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_league_from_tip on public.tips;
create trigger trg_sync_league_from_tip
after insert or update of league, league_name, country, sport on public.tips
for each row execute function public.sync_league_from_tip();

-- Dopisz ligi z już istniejących typów.
insert into public.leagues(name, country, sport, source, updated_at)
select distinct coalesce(nullif(league_name,''), league), nullif(country,''), coalesce(nullif(sport,''),'football'), 'backfill_tips', now()
from public.tips
where coalesce(league_name, league, '') <> ''
on conflict (name, sport) do update set
  country = coalesce(excluded.country, public.leagues.country),
  updated_at = now();

-- Widoki: LIVE tylko realne API-Football/live_ai_engine, pre-match osobno.
drop view if exists public.ai_live_events_feed cascade;
create view public.ai_live_events_feed as
select * from public.tips
where ai_source = 'real_ai_engine'
  and (
    lower(coalesce(source,'')) like 'live_ai_engine%'
    or live_status is not null
    or coalesce(live_minute,0) > 0
  )
order by created_at desc;

drop view if exists public.ai_prematch_events_feed cascade;
create view public.ai_prematch_events_feed as
select * from public.tips
where ai_source = 'real_ai_engine'
  and not (
    lower(coalesce(source,'')) like 'live_ai_engine%'
    or live_status is not null
    or coalesce(live_minute,0) > 0
  )
order by coalesce(event_time, kickoff_time, match_time, created_at) desc;

notify pgrst, 'reload schema';
