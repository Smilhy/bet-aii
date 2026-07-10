-- WERSJA 1882 — ALGORYTM: wybór po wyższym prawdopodobieństwie,
-- pełny automat co 15 minut oraz historia uruchomień.
-- Ten plik jest migracją po WERSJA_1880_ALGORITHM_OVER_UNDER_25.sql.

create extension if not exists pgcrypto;

create table if not exists public.algorithm_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'scan'
    check (run_type in ('scan', 'settle', 'cycle')),
  status text not null default 'success'
    check (status in ('success', 'partial', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fixtures_loaded integer not null default 0,
  candidates_considered integer not null default 0,
  rows_saved integer not null default 0,
  bets_saved integer not null default 0,
  skipped_errors integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists algorithm_runs_started_at_idx
on public.algorithm_runs(started_at desc);

create index if not exists algorithm_runs_type_started_idx
on public.algorithm_runs(run_type, started_at desc);

alter table public.algorithm_runs enable row level security;

drop policy if exists "algorithm runs public read"
on public.algorithm_runs;

create policy "algorithm runs public read"
on public.algorithm_runs
for select
to anon, authenticated
using (true);

grant select on public.algorithm_runs to anon, authenticated;

-- Nowe rekordy od wersji 1882 mają ten model domyślnie.
alter table if exists public.algorithm_bets
  alter column model_version set default 'pressure-ou25-v2-probability-51';

comment on table public.algorithm_runs is
'Historia automatycznych skanów i rozliczeń algorytmu Over/Under 2.5.';

comment on column public.algorithm_bets.edge_pct is
'Informacyjny EV kursu wybranego rynku. Od wersji 1882 EV nie wybiera kierunku zakładu.';

comment on table public.algorithm_bets is
'Automatyczny test modelu presji O/U 2.5. Kierunek wybiera wyższe prawdopodobieństwo, próg 51%, płaska stawka 1 jednostka.';
