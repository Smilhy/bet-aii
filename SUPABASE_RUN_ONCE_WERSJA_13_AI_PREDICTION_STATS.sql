-- BETAI WERSJA 13 — HISTORIA I SKUTECZNOŚĆ AI PREDICTION
-- Uruchom jeden raz w Supabase SQL Editor przed wdrożeniem wersji 13.

begin;

create table if not exists public.ai_prediction_history (
  fixture_id text primary key,
  kickoff timestamptz not null,
  country text,
  league text,
  home_team text not null,
  away_team text not null,
  home_logo text,
  away_logo text,
  market_key text not null default '1x2',
  pick_key text not null check (pick_key in ('home', 'draw', 'away')),
  pick_label text,
  confidence numeric,
  true_odds numeric,
  best_odds numeric,
  bookmaker text,
  edge numeric,
  model_source text,
  model_version text not null default 'betai-ai-prediction-v13',
  snapshot_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  actual_key text check (actual_key is null or actual_key in ('home', 'draw', 'away')),
  home_score integer,
  away_score integer,
  profit_units numeric,
  settlement_reason text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_prediction_history_pending_kickoff_idx
  on public.ai_prediction_history (kickoff asc)
  where status = 'pending';

create index if not exists ai_prediction_history_settled_at_idx
  on public.ai_prediction_history (settled_at desc)
  where status in ('won', 'lost', 'void');

create index if not exists ai_prediction_history_model_version_idx
  on public.ai_prediction_history (model_version, status, kickoff desc);

alter table public.ai_prediction_history enable row level security;

-- Brak publicznych polityk jest celowy: zapis i odczyt statystyk odbywa się
-- wyłącznie przez funkcje Netlify używające service role key.

commit;

select
  status,
  count(*) as rekordy
from public.ai_prediction_history
group by status
order by status;
