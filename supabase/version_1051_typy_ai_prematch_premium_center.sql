-- supabase/version_1051_typy_ai_prematch_premium_center.sql
-- Typy AI Premium Pre-match Center.
-- Minimalna, bezpieczna migracja: tylko kolumny/widoki używane przez AI Center.

create extension if not exists pgcrypto;

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
  updated_at timestamptz default now()
);

alter table public.ai_leagues_catalog add column if not exists country text;
alter table public.ai_leagues_catalog add column if not exists tips_count integer not null default 0;
alter table public.ai_leagues_catalog add column if not exists won_count integer not null default 0;
alter table public.ai_leagues_catalog add column if not exists lost_count integer not null default 0;
alter table public.ai_leagues_catalog add column if not exists push_count integer not null default 0;
alter table public.ai_leagues_catalog add column if not exists pending_count integer not null default 0;
alter table public.ai_leagues_catalog add column if not exists avg_ai_score numeric not null default 0;
alter table public.ai_leagues_catalog add column if not exists avg_odds numeric not null default 0;
alter table public.ai_leagues_catalog add column if not exists last_seen timestamptz default now();
alter table public.ai_leagues_catalog add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_leagues_catalog_sport_league_key'
      and conrelid = 'public.ai_leagues_catalog'::regclass
  ) then
    alter table public.ai_leagues_catalog
    add constraint ai_leagues_catalog_sport_league_key unique (sport, league);
  end if;
exception when others then null;
end $$;

alter table public.ai_leagues_catalog enable row level security;

drop policy if exists "ai_leagues_catalog_select_all_v1051" on public.ai_leagues_catalog;
create policy "ai_leagues_catalog_select_all_v1051"
on public.ai_leagues_catalog
for select
to authenticated
using (true);

drop policy if exists "ai_leagues_catalog_service_write_v1051" on public.ai_leagues_catalog;
create policy "ai_leagues_catalog_service_write_v1051"
on public.ai_leagues_catalog
for all
to service_role
using (true)
with check (true);

create index if not exists tips_ai_external_key_idx_v1051 on public.tips(ai_external_key);
create index if not exists tips_ai_stats_idx_v1051 on public.tips(sport, league, market, status);

select 'v1051 typy ai prematch premium center ready' as status;
