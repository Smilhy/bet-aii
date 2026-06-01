-- Opcjonalne kolumny dla pokazywania wyniku meczu w Mecze Result.
-- Nie są wymagane do status/result/profit, ale pozwalają wyświetlić score zamiast -:-.
alter table public.ai_bets add column if not exists live_score_home numeric;
alter table public.ai_bets add column if not exists live_score_away numeric;
alter table public.ai_bets add column if not exists live_status text;
alter table public.ai_bets add column if not exists settled_at timestamptz;
