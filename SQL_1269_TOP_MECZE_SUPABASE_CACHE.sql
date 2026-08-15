-- =====================================================
-- 1269 STEP2: Cache Top Mecze / wydarzeń sportowych w Supabase
-- Cel: po pierwszym pobraniu mecze zapisują się w Supabase,
--      a kolejne wejścia czytają cache zamiast zużywać pakiety API-Football.
-- Tabela jest używana przez netlify/functions/get-sports-events.js
-- =====================================================

create table if not exists public.sports_fixture_cache (
  cache_key text primary key,
  sport text,
  country text,
  league text,
  home text,
  away text,
  commence_time timestamptz,
  fixture_json jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
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

-- Jeśli tabela już istniała bez primary key, spróbuj dodać unikalność wymaganą przez upsert.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sports_fixture_cache_pkey'
      and conrelid = 'public.sports_fixture_cache'::regclass
  ) then
    alter table public.sports_fixture_cache
    add constraint sports_fixture_cache_pkey primary key (cache_key);
  end if;
exception when others then
  -- Jeżeli istnieją duplikaty albo constraint już jest pod inną nazwą, nie przerywaj całej migracji.
  raise notice 'Primary key sports_fixture_cache_pkey skipped: %', sqlerrm;
end $$;

create index if not exists idx_sports_fixture_cache_sport
on public.sports_fixture_cache(sport);

create index if not exists idx_sports_fixture_cache_country_league
on public.sports_fixture_cache(country, league);

create index if not exists idx_sports_fixture_cache_commence_time
on public.sports_fixture_cache(commence_time);

create index if not exists idx_sports_fixture_cache_expires_at
on public.sports_fixture_cache(expires_at);

-- Funkcja Netlify używa SUPABASE_SERVICE_ROLE_KEY, więc nie musi mieć publicznego dostępu.
-- RLS może być włączone; service role i tak zapisze/odczyta cache po stronie serwera.
alter table public.sports_fixture_cache enable row level security;

notify pgrst, 'reload schema';
