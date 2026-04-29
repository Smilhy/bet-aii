# BetAI — wersja 139 LIVE AI PICKS FINAL

Dodano końcowy etap AI:
- realne pre-match AI z Odds API,
- LIVE AI z API-Football,
- osobny endpoint `/.netlify/functions/generate-live-ai-picks`,
- zakładka Typy AI ma przycisk `Generate LIVE AI`,
- Dashboard dalej pokazuje typy użytkowników.

## Wdrożenie
1. Wrzuć całą paczkę na GitHub.
2. Supabase SQL Editor: odpal `supabase/version_139_live_ai_picks.sql`.
3. Netlify ENV: `OPENAI_API_KEY`, `API_FOOTBALL_KEY`, `ODDS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` / `SUPABASE_URL`.
4. Netlify: Clear cache and deploy site.
5. Zakładka Typy AI: kliknij `Generate AI Picks` albo `Generate LIVE AI`.
