# wersja 142 — LIVE AI real-only visibility

Poprawki:
- Typy AI domyślnie otwierają zakładkę LIVE realne mecze.
- LIVE lista filtruje tylko rekordy z `ai_source = real_ai_engine` oraz `source` zaczynającym się od `live_ai_engine` albo z polami `live_status/live_minute`.
- Pre-match AI i wszystkie AI są osobno, żeby nie mieszać sztucznych/starych typów z realnymi LIVE.
- SQL usuwa ewentualne demo/mock/sample rekordy AI z Supabase.
- SQL automatycznie dopisuje brakujące ligi do tabeli `leagues` przy każdym nowym typie.

Po wdrożeniu uruchom w Supabase:
`supabase/version_142_live_real_only_visibility.sql`

W Netlify ENV muszą być:
- `API_FOOTBALL_KEY`
- `SUPABASE_URL` albo `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- opcjonalnie `OPENAI_API_KEY`
