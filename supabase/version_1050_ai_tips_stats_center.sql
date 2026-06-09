
-- supabase/version_1050_ai_tips_stats_center.sql
-- Typy AI + Statystyki:
-- - katalog lig AI,
-- - automatyczne dopisywanie nowych lig z tabeli tips,
-- - widok statystyk po ligach/rynkach,
-- - kompatybilne z istniejącą tabelą tips.

create extension if not exists pgcrypto;

create table if not exists public.ai_leagues_catalog (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  league text not null,
  country text,
  tips_count integer not null default 0,
  won_count integer not null default 0,
  lost_count integer not null default 0,
  push_count integer not null default 0,
  pending_count integer not null default 0,
  avg_ai_score numeric not null default 0,
  avg_odds numeric not null default 0,
  last_seen timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sport, league)
);

alter table public.ai_leagues_catalog enable row level security;

drop policy if exists "ai_leagues_catalog_select_all_v1050" on public.ai_leagues_catalog;
create policy "ai_leagues_catalog_select_all_v1050"
on public.ai_leagues_catalog
for select
to authenticated
using (true);

drop policy if exists "ai_leagues_catalog_service_write_v1050" on public.ai_leagues_catalog;
create policy "ai_leagues_catalog_service_write_v1050"
on public.ai_leagues_catalog
for all
to service_role
using (true)
with check (true);

alter table if exists public.tips add column if not exists ai_external_key text;
alter table if exists public.tips add column if not exists ai_source text;
alter table if exists public.tips add column if not exists ai_model_version text;
alter table if exists public.tips add column if not exists ai_score numeric default 0;
alter table if exists public.tips add column if not exists ai_confidence numeric default 0;
alter table if exists public.tips add column if not exists value_score numeric default 0;
alter table if exists public.tips add column if not exists risk_level text;
alter table if exists public.tips add column if not exists ai_analysis text;
alter table if exists public.tips add column if not exists curiosity text;
alter table if exists public.tips add column if not exists live_score_home integer default 0;
alter table if exists public.tips add column if not exists live_score_away integer default 0;

create index if not exists tips_ai_external_key_idx_v1050 on public.tips(ai_external_key);
create index if not exists tips_ai_stats_idx_v1050 on public.tips(sport, league, market, status);

create or replace function public.betai_ai_normalize_result(p_status text, p_result text default null)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_result, p_status, '')) in ('won','win','wygrany','wygrana') then 'won'
    when lower(coalesce(p_result, p_status, '')) in ('lost','lose','loss','przegrany','przegrana') then 'lost'
    when lower(coalesce(p_result, p_status, '')) in ('void','push','zwrot') then 'push'
    else 'pending'
  end;
$$;

create or replace function public.refresh_ai_league_catalog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.tips') is null then
    return;
  end if;

  insert into public.ai_leagues_catalog (
    sport, league, country, tips_count, won_count, lost_count, push_count, pending_count,
    avg_ai_score, avg_odds, last_seen, updated_at
  )
  select
    coalesce(nullif(sport,''), nullif(sport_key,''), 'Inne') as sport,
    coalesce(nullif(league,''), nullif(league_name,''), nullif(country,''), 'Inne') as league,
    max(country) as country,
    count(*)::integer as tips_count,
    count(*) filter (where public.betai_ai_normalize_result(status, result) = 'won')::integer as won_count,
    count(*) filter (where public.betai_ai_normalize_result(status, result) = 'lost')::integer as lost_count,
    count(*) filter (where public.betai_ai_normalize_result(status, result) = 'push')::integer as push_count,
    count(*) filter (where public.betai_ai_normalize_result(status, result) = 'pending')::integer as pending_count,
    round(avg(coalesce(ai_score, ai_confidence, 0))::numeric, 2) as avg_ai_score,
    round(avg(coalesce(odds, 0))::numeric, 2) as avg_odds,
    max(coalesce(event_time, created_at, now())) as last_seen,
    now() as updated_at
  from public.tips
  where lower(coalesce(ai_source, source, '')) like '%ai%'
     or ai_external_key is not null
  group by
    coalesce(nullif(sport,''), nullif(sport_key,''), 'Inne'),
    coalesce(nullif(league,''), nullif(league_name,''), nullif(country,''), 'Inne')
  on conflict (sport, league)
  do update set
    country = excluded.country,
    tips_count = excluded.tips_count,
    won_count = excluded.won_count,
    lost_count = excluded.lost_count,
    push_count = excluded.push_count,
    pending_count = excluded.pending_count,
    avg_ai_score = excluded.avg_ai_score,
    avg_odds = excluded.avg_odds,
    last_seen = excluded.last_seen,
    updated_at = now();
end;
$$;

create or replace function public.betai_ai_league_catalog_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_ai_league_catalog();
  return coalesce(new, old);
end;
$$;

drop trigger if exists tips_ai_league_catalog_refresh_v1050 on public.tips;
create trigger tips_ai_league_catalog_refresh_v1050
after insert or update of sport, sport_key, league, league_name, country, status, result, odds, ai_score, ai_confidence, ai_source, source, ai_external_key
on public.tips
for each statement
execute function public.betai_ai_league_catalog_trigger();

create or replace view public.ai_tips_stats_summary as
select
  coalesce(nullif(sport,''), nullif(sport_key,''), 'Inne') as sport,
  coalesce(nullif(league,''), nullif(league_name,''), nullif(country,''), 'Inne') as league,
  coalesce(nullif(market,''), nullif(bet_type,''), 'Typ AI') as bet_type,
  count(*)::integer as total_tips,
  count(*) filter (where public.betai_ai_normalize_result(status, result) = 'won')::integer as won,
  count(*) filter (where public.betai_ai_normalize_result(status, result) = 'lost')::integer as lost,
  count(*) filter (where public.betai_ai_normalize_result(status, result) = 'push')::integer as push,
  count(*) filter (where public.betai_ai_normalize_result(status, result) = 'pending')::integer as pending,
  round(avg(coalesce(odds, 0))::numeric, 2) as avg_odds,
  round(avg(coalesce(ai_score, ai_confidence, 0))::numeric, 2) as avg_ai_score,
  round(avg(coalesce(value_score, 0))::numeric, 2) as avg_value_score
from public.tips
where lower(coalesce(ai_source, source, '')) like '%ai%'
   or ai_external_key is not null
group by
  coalesce(nullif(sport,''), nullif(sport_key,''), 'Inne'),
  coalesce(nullif(league,''), nullif(league_name,''), nullif(country,''), 'Inne'),
  coalesce(nullif(market,''), nullif(bet_type,''), 'Typ AI');

grant select on public.ai_leagues_catalog to authenticated;
grant select on public.ai_tips_stats_summary to authenticated;
grant execute on function public.refresh_ai_league_catalog() to authenticated;
grant execute on function public.betai_ai_normalize_result(text, text) to authenticated;

select public.refresh_ai_league_catalog();

select 'v1050 ai tips stats center ready' as status;
