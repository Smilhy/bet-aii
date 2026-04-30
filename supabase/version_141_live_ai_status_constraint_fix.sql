-- VERSION 141 — LIVE AI STATUS CONSTRAINT FIX
-- Naprawia błąd: new row for relation "tips" violates check constraint "tips_status_check".
-- LIVE typy mają tips.status = pending, a realny status meczu jest w live_status.

alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists result text default 'pending';
alter table public.tips add column if not exists status text default 'pending';

update public.tips
set status = 'pending'
where lower(coalesce(status, 'pending')) not in ('pending','won','lost','void');

alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips
  add constraint tips_status_check
  check (status in ('pending','won','lost','void'));

create index if not exists idx_tips_live_status_v141 on public.tips(live_status);
create index if not exists idx_tips_live_source_v141 on public.tips(ai_source, source, result, created_at desc);

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

notify pgrst, 'reload schema';
