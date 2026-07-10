-- WERSJA 1885 — wszystkie przyszłe mecze widoczne od razu,
-- kolejka obliczeń i trwały cache statystyk historycznych.
-- Uruchom po migracjach V1880 i V1882.

create extension if not exists pgcrypto;

alter table if exists public.algorithm_bets
  add column if not exists analysis_state text not null default 'ready';

alter table if exists public.algorithm_bets
  add column if not exists analysis_error text not null default '';

alter table if exists public.algorithm_bets
  add column if not exists analysis_attempts integer not null default 0;

alter table if exists public.algorithm_bets
  add column if not exists analysis_updated_at timestamptz not null default now();

-- Ujednolicenie starszych rekordów.
update public.algorithm_bets
set analysis_state = 'ready'
where analysis_state is null or analysis_state = '';

alter table public.algorithm_bets
  drop constraint if exists algorithm_bets_analysis_state_check;

alter table public.algorithm_bets
  add constraint algorithm_bets_analysis_state_check
  check (analysis_state in ('waiting_stats', 'ready'));

create index if not exists algorithm_bets_analysis_state_kickoff_idx
on public.algorithm_bets(analysis_state, kickoff asc);

-- Każdy historyczny mecz jest pobierany z API tylko raz.
-- To mocno ogranicza liczbę zapytań API-Sports i pozwala kolejnym
-- skanom kontynuować pracę zamiast zaczynać wszystko od początku.
create table if not exists public.algorithm_fixture_stats_cache (
  fixture_id bigint primary key,
  statistics jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists algorithm_fixture_stats_cache_fetched_idx
on public.algorithm_fixture_stats_cache(fetched_at desc);

alter table public.algorithm_fixture_stats_cache enable row level security;

-- Tabela jest techniczna. Tylko Service Role w funkcjach Netlify ma zapis/odczyt.
-- Nie dodajemy polityki publicznego dostępu.

alter table if exists public.algorithm_bets
  alter column model_version set default 'pressure-ou25-v4-queue-cache-all-fixtures';

comment on column public.algorithm_bets.analysis_state is
'waiting_stats = mecz odkryty i widoczny, automat jeszcze pobiera dane; ready = obliczenie zakończone.';

comment on table public.algorithm_fixture_stats_cache is
'Cache historycznych statystyk strzałów i rożnych używanych przez algorytm O/U 2.5.';
