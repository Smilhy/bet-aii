-- Bet+AI WERSJA 320 — REALISTIC MATCH ENGINE + LIVE AI COACH ALL-IN
-- Match simulation layer only. Nie zmienia Prediction Engine V200/V260/V280.
-- URUCHOM RAZ: Supabase -> SQL Editor -> Run.

create table if not exists public.match_simulation_runs_v320 (
  run_key text primary key,
  fixture_id text not null,
  simulation_seed bigint not null,
  simulation_ordinal integer not null default 0,
  engine_version text not null default 'BETAI_REALISTIC_MATCH_ENGINE_V320',
  prediction_version text null,
  active_model text null,
  home_team text not null default '',
  away_team text not null default '',
  league text not null default '',
  pre_match jsonb not null default '{}'::jsonb,
  final_score jsonb not null default '{}'::jsonb,
  final_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists idx_match_simulation_runs_v320_fixture
  on public.match_simulation_runs_v320(fixture_id, created_at desc);
create index if not exists idx_match_simulation_runs_v320_engine
  on public.match_simulation_runs_v320(engine_version, created_at desc);
create index if not exists idx_match_simulation_runs_v320_seed
  on public.match_simulation_runs_v320(simulation_seed);

alter table public.match_simulation_runs_v320 enable row level security;

comment on table public.match_simulation_runs_v320 is
  'V320 deterministic seeded match replays generated from the frozen Bet+AI pre-match Prediction Engine profile. The animation layer does not create a second pre-match forecast.';

-- Feature flags are optional. If V300 exists, register V320 controls.
insert into public.match_feature_flags_v300(flag_key,enabled,rollout_pct,admin_only,description)
values
  ('realistic_match_engine_v320',true,100,false,'V320 Canvas realistic possession/pass/pressing match engine'),
  ('live_ai_coach_v320',true,100,false,'V320 live probability and simulated-market signal layer')
on conflict (flag_key) do update set description = excluded.description, updated_at = now();

-- KONTROLA:
-- select fixture_id,simulation_seed,final_score,completed_at
-- from public.match_simulation_runs_v320 order by completed_at desc limit 20;
