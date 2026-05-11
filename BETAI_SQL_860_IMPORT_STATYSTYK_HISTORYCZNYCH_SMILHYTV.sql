-- BETAI SQL 860 — import historycznych statystyk smilhytv
-- Uruchom raz w Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS imported_yield numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_total_tips integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_won_tips integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_lost_tips integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_pending_tips integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_total_staked numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_profit numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_avg_odds numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_highest_odds numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_tips_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_tips_currency text DEFAULT 'zł',
  ADD COLUMN IF NOT EXISTS stats_imported_at timestamptz;

UPDATE public.profiles
SET
  imported_yield = 39.00,
  imported_total_tips = 689,
  imported_won_tips = 403,
  imported_lost_tips = 286,
  imported_pending_tips = 2,
  imported_total_staked = 202800.00,
  imported_profit = 79919.89,
  imported_avg_odds = 1.86,
  imported_highest_odds = 48.00,
  imported_tips_amount = 1.34,
  imported_tips_currency = 'USD',
  stats_imported_at = now()
WHERE lower(username) = 'smilhytv';

-- Po imporcie kafelki pokazują bazę historyczną, a nowe typy dodane później
-- będą dopisywane automatycznie do tych statystyk.
