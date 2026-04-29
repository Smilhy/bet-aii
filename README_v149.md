# Wersja 149 — krok 1

Dodane:
- ręczne rozliczanie zakończonych meczów przyciskiem „Rozlicz zakończone”,
- Netlify function `settle-live-ai-picks`,
- poprawne statusy `won/lost/void` zamiast błędnego `win/loss` w kolumnie status,
- profit / ROI / winrate po rozliczeniu,
- widoki Supabase: `ai_stats_v149`, `ai_market_stats_v149`, `ai_league_stats_v149`, `ai_settled_picks`, `ai_open_picks`.

Uruchom SQL:
`supabase/version_149_auto_settlement_stats_step.sql`
