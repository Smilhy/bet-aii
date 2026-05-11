-- BETAI SQL 865 — realne herby drużyn przy typach
-- Uruchom raz w Supabase SQL Editor.

ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS fixture_id text,
  ADD COLUMN IF NOT EXISTS home_team_id text,
  ADD COLUMN IF NOT EXISTS away_team_id text,
  ADD COLUMN IF NOT EXISTS home_logo text,
  ADD COLUMN IF NOT EXISTS away_logo text;

-- Od tej wersji nowe typy dodane z realnego meczu zapisują:
-- fixture_id, home_team_id, away_team_id, home_logo, away_logo.
-- Jeżeli API ma tylko team_id, frontend zbuduje realny URL herbu:
-- https://media.api-sports.io/football/teams/{team_id}.png
