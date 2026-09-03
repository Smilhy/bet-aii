-- Bet+AI v131
-- Uruchom RAZ w Supabase SQL Editor.
-- Stabilny snapshot danych dla Symulatora AI: jeżeli mecz raz uzyska dobry zestaw danych,
-- kolejne wejścia i deploye użyją najlepszego zapisanego zestawu zamiast pogarszać wynik
-- przez chwilowy brak odpowiedzi z API-Football.

create table if not exists public.match_simulator_snapshots (
  fixture_id text primary key,
  fixture_date timestamptz null,
  home_team text not null default '',
  away_team text not null default '',
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  eligible boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_match_simulator_snapshots_fixture_date
  on public.match_simulator_snapshots(fixture_date);

create index if not exists idx_match_simulator_snapshots_quality
  on public.match_simulator_snapshots(eligible, quality_score desc);

alter table public.match_simulator_snapshots enable row level security;

-- Brak publicznych policy jest celowy. Tabelę czytają i zapisują wyłącznie
-- funkcje Netlify przez SUPABASE_SERVICE_ROLE_KEY, która omija RLS.

comment on table public.match_simulator_snapshots is
  'Najlepszy trwały snapshot danych Bet+AI Match Simulator dla fixture_id.';
