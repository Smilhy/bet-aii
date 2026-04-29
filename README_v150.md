# Wersja 147 — real AI PRE/LIVE schema fix

Naprawia błąd `record "new" has no field "confidence"` przy kliknięciu generowania/skanowania.

Co zmieniono:
- wyłączony stary trigger z wersji 146, który losowo nadpisywał PRE typy,
- dodane brakujące kolumny `confidence`, `ai_confidence`, `model_probability`, `external_fixture_id` itd.,
- LIVE i PRE są rozdzielone w widokach,
- realne mecze zostają tylko z `ai_source = real_ai_engine` i `source = live_ai_engine`.

Uruchom w Supabase:
`supabase/version_147_real_ai_no_random_schema_fix.sql`
