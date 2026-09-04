-- Bet+AI v136 — Prediction Engine snapshot/backtesting foundation
-- Uruchom RAZ w Supabase SQL Editor.

create table if not exists public.match_prediction_snapshots (
  fixture_id text primary key,
  fixture_date timestamptz null,
  home_team text not null default '',
  away_team text not null default '',
  league text not null default '',
  country text not null default '',
  model_version text not null default 'BETAI_FORECAST_V1',
  data_quality integer not null default 0 check (data_quality >= 0 and data_quality <= 100),
  source_count integer not null default 0,
  consensus_agreement integer not null default 0 check (consensus_agreement >= 0 and consensus_agreement <= 100),
  forecast jsonb not null default '{}'::jsonb,
  consensus jsonb not null default '{}'::jsonb,
  actual_home_goals integer null,
  actual_away_goals integer null,
  settled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_match_prediction_snapshots_fixture_date
  on public.match_prediction_snapshots(fixture_date);

create index if not exists idx_match_prediction_snapshots_model_quality
  on public.match_prediction_snapshots(model_version, data_quality desc);

create index if not exists idx_match_prediction_snapshots_unsettled
  on public.match_prediction_snapshots(settled_at)
  where settled_at is null;

alter table public.match_prediction_snapshots enable row level security;

comment on table public.match_prediction_snapshots is
  'Przedmeczowe prognozy Bet+AI zapisane przed kickoffem do późniejszego backtestingu i kalibracji.';

-- Brak publicznych policy jest celowy.
-- Netlify Functions zapisują przez SUPABASE_SERVICE_ROLE_KEY.
