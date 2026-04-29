# Wersja 144 — tylko realne mecze

Zmiany:
- usunięty fake `Generate AI Picks` i funkcja `generate-ai-picks.js`,
- zostaje tylko skaner realnych meczów API-Football: LIVE teraz + mecze startujące w najbliższych godzinach,
- automatyczne dopisywanie brakujących lig do `league_catalog`,
- widoki Supabase tylko dla realnych meczów,
- dodany endpoint `settle-live-ai-picks.js` do rozliczania meczów po FT,
- statystyki globalne i per liga z realnych AI picków.

W Supabase uruchom:
`supabase/version_144_real_matches_only_auto_settlement_stats.sql`

W Netlify ENV wymagane:
- `API_FOOTBALL_KEY`
- `SUPABASE_URL` albo `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- opcjonalnie `OPENAI_API_KEY`

Endpointy:
- `/.netlify/functions/generate-live-ai-picks` — pobiera realne LIVE/soon mecze,
- `/.netlify/functions/settle-live-ai-picks` — rozlicza zakończone mecze.
