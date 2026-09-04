-- Bet+AI v139 — AI Value Scanner cache
-- Uruchom RAZ w Supabase -> SQL Editor.

create table if not exists public.match_value_scan_snapshots (
  fixture_id text primary key,
  fixture_date timestamptz null,
  home_team text not null default '',
  away_team text not null default '',
  league text not null default '',
  country text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_match_value_scan_snapshots_fixture_date
  on public.match_value_scan_snapshots(fixture_date);

create index if not exists idx_match_value_scan_snapshots_updated
  on public.match_value_scan_snapshots(updated_at desc);

alter table public.match_value_scan_snapshots enable row level security;

comment on table public.match_value_scan_snapshots is
  'Rate-safe pre-match AI Value Scanner snapshots. Full match analysis remains the final source for Bet+AI recommendations.';

-- Brak publicznych policy jest celowy.
-- Netlify Functions używają SUPABASE_SERVICE_ROLE_KEY.
