-- BET+AI WERSJA 1688 — RESET STATYSTYK TYLKO DLA TYPÓW AI
-- Uruchom w Supabase SQL Editor.
-- To czyści public.ai_bets, czyli Typy AI / Mecze Result / Statystyki AI.
-- Nie rusza typów typerów/użytkowników w public.tips.

delete from public.ai_bets;

-- Kontrola po resecie:
select count(*) as ai_bets_after_reset from public.ai_bets;
