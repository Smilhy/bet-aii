-- Bet+AI v137 — Backtesting & Calibration Engine
-- Uruchom RAZ w Supabase -> SQL Editor.

alter table public.match_prediction_snapshots
  add column if not exists settlement_status text not null default 'pending',
  add column if not exists fixture_status text null,
  add column if not exists settlement jsonb not null default '{}'::jsonb,
  add column if not exists locked_at timestamptz null;

-- Stare rekordy, które były już rozliczone przed v137.
update public.match_prediction_snapshots
set settlement_status = case
  when settled_at is null then 'pending'
  when actual_home_goals is not null and actual_away_goals is not null then 'settled'
  else 'void'
end
where settlement_status is null
   or settlement_status = 'pending';

create index if not exists idx_match_prediction_snapshots_pending_settlement
  on public.match_prediction_snapshots(fixture_date)
  where settled_at is null;

create index if not exists idx_match_prediction_snapshots_model_settled
  on public.match_prediction_snapshots(model_version, settled_at desc)
  where actual_home_goals is not null and actual_away_goals is not null;

create index if not exists idx_match_prediction_snapshots_league_settled
  on public.match_prediction_snapshots(league, settled_at desc)
  where actual_home_goals is not null and actual_away_goals is not null;

comment on column public.match_prediction_snapshots.locked_at is
  'Moment blokady prognozy. Po kickoffie forecast nie może być już zmieniany.';

comment on column public.match_prediction_snapshots.settlement is
  'Rzeczywisty wynik i status pobrane po meczu do backtestingu modelu Bet+AI.';
