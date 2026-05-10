-- WERSJA 770 — automatyczny dzienny zapis meczów dla "Dodaj typ" i "Typy AI"

create table if not exists public.sports_fixture_cache (
  cache_key text primary key,
  sport text not null default 'Piłka nożna',
  country text not null default '',
  league text not null default '',
  home text not null default '',
  away text not null default '',
  commence_time timestamptz,
  fixture_json jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sports_fixture_cache_expires_at_idx
  on public.sports_fixture_cache (expires_at);

create index if not exists sports_fixture_cache_commence_time_idx
  on public.sports_fixture_cache (commence_time);

create index if not exists sports_fixture_cache_home_idx
  on public.sports_fixture_cache (lower(home));

create index if not exists sports_fixture_cache_away_idx
  on public.sports_fixture_cache (lower(away));

alter table public.sports_fixture_cache enable row level security;

-- Cache jest używany tylko przez backend Netlify przez SUPABASE_SERVICE_ROLE_KEY.
-- Nie dodajemy publicznych policy.
