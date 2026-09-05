Bet+AI WERSJA 329 — HIDE V158 OFFLINE TEST

Zmiana:
- panel "BET+AI MODEL VALIDATION & RISK LAB V158 • TEST OFFLINE" jest ukryty z produkcyjnego widoku Symulacji AI,
- kod testu NIE został usunięty,
- nie zmieniono Prediction Engine, V320, whitelisty 17 lig, API, Supabase ani logiki symulacji.

Przywrócenie testu:
1. Otwórz src/MatchSimulatorDailyMatchesView.jsx
2. Znajdź:
   const SHOW_V158_OFFLINE_TEST = false
3. Zmień na:
   const SHOW_V158_OFFLINE_TEST = true

SQL: niepotrzebny.
