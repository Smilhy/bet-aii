-- BET+AI 753 — automatyczny katalog lig AI + pamięć dropdownu DIVISION
-- Wklej całość w Supabase -> SQL Editor -> Run.

create table if not exists public.ai_leagues_catalog (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  league text not null,
  country text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  tips_count integer not null default 0,
  unique (sport, league)
);

create index if not exists idx_ai_leagues_catalog_sport_league_v753
  on public.ai_leagues_catalog (sport, league);

create index if not exists idx_ai_leagues_catalog_last_seen_v753
  on public.ai_leagues_catalog (last_seen desc);

create or replace function public.sync_ai_league_catalog_from_tip_v753()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sport text;
  v_league text;
  v_country text;
begin
  if coalesce(new.ai_source, '') <> 'real_ai_engine'
     and coalesce(new.source, '') <> 'live_ai_engine' then
    return new;
  end if;

  v_sport := nullif(trim(coalesce(new.sport, new.sport_key, '')), '');
  v_league := nullif(trim(coalesce(new.league, new.league_name, new.country, '')), '');
  v_country := nullif(trim(coalesce(new.country, '')), '');

  if v_sport is null or v_league is null then
    return new;
  end if;

  insert into public.ai_leagues_catalog (sport, league, country, first_seen, last_seen, tips_count)
  values (v_sport, v_league, v_country, now(), now(), case when tg_op = 'INSERT' then 1 else 0 end)
  on conflict (sport, league)
  do update set
    country = coalesce(excluded.country, public.ai_leagues_catalog.country),
    last_seen = now(),
    tips_count = public.ai_leagues_catalog.tips_count + case when tg_op = 'INSERT' then 1 else 0 end;

  return new;
end;
$$;

drop trigger if exists trg_sync_ai_league_catalog_v753 on public.tips;
create trigger trg_sync_ai_league_catalog_v753
after insert or update of sport, sport_key, league, league_name, country, ai_source, source
on public.tips
for each row
execute function public.sync_ai_league_catalog_from_tip_v753();

-- Wypełnienie katalogu lig istniejącymi już typami AI.
insert into public.ai_leagues_catalog (sport, league, country, first_seen, last_seen, tips_count)
select
  coalesce(sport, sport_key) as sport,
  coalesce(league, league_name, country) as league,
  max(country) as country,
  min(created_at) as first_seen,
  max(coalesce(updated_at, created_at)) as last_seen,
  count(*)::integer as tips_count
from public.tips
where (ai_source = 'real_ai_engine' or source = 'live_ai_engine')
  and nullif(trim(coalesce(sport, sport_key, '')), '') is not null
  and nullif(trim(coalesce(league, league_name, country, '')), '') is not null
group by coalesce(sport, sport_key), coalesce(league, league_name, country)
on conflict (sport, league)
do update set
  country = coalesce(excluded.country, public.ai_leagues_catalog.country),
  first_seen = least(public.ai_leagues_catalog.first_seen, excluded.first_seen),
  last_seen = greatest(public.ai_leagues_catalog.last_seen, excluded.last_seen),
  tips_count = greatest(public.ai_leagues_catalog.tips_count, excluded.tips_count);

alter table public.ai_leagues_catalog enable row level security;

drop policy if exists "ai leagues select v753" on public.ai_leagues_catalog;
create policy "ai leagues select v753"
on public.ai_leagues_catalog for select
to anon, authenticated
using (true);

drop policy if exists "ai leagues insert v753" on public.ai_leagues_catalog;
create policy "ai leagues insert v753"
on public.ai_leagues_catalog for insert
to anon, authenticated
with check (true);

drop policy if exists "ai leagues update v753" on public.ai_leagues_catalog;
create policy "ai leagues update v753"
on public.ai_leagues_catalog for update
to anon, authenticated
using (true)
with check (true);
