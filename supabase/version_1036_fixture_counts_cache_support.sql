
-- supabase/version_1036_fixture_counts_cache_support.sql
-- Wsparcie dla liczników meczów przy krajach i ligach.
-- Korzysta z istniejącej tabeli sports_fixture_cache.
-- Nie pobiera API; tylko pozwala szybko czytać cache.

create extension if not exists pgcrypto;

create table if not exists public.sports_fixture_cache (
  cache_key text primary key,
  sport text,
  country text,
  league text,
  home text,
  away text,
  commence_time timestamptz,
  fixture_json jsonb,
  fetched_at timestamptz default now(),
  expires_at timestamptz
);

alter table public.sports_fixture_cache
  add column if not exists cache_key text;

alter table public.sports_fixture_cache
  add column if not exists sport text;

alter table public.sports_fixture_cache
  add column if not exists country text;

alter table public.sports_fixture_cache
  add column if not exists league text;

alter table public.sports_fixture_cache
  add column if not exists home text;

alter table public.sports_fixture_cache
  add column if not exists away text;

alter table public.sports_fixture_cache
  add column if not exists commence_time timestamptz;

alter table public.sports_fixture_cache
  add column if not exists fixture_json jsonb;

alter table public.sports_fixture_cache
  add column if not exists fetched_at timestamptz default now();

alter table public.sports_fixture_cache
  add column if not exists expires_at timestamptz;

create index if not exists sports_fixture_cache_counts_idx_v1036
on public.sports_fixture_cache (expires_at, commence_time, country, league);

create index if not exists sports_fixture_cache_country_league_idx_v1036
on public.sports_fixture_cache (country, league);

select 'v1036 fixture counts cache support ready' as status;
