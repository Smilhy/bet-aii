# Wersja 145 — PRE matches external_fixture_id fix

Naprawia skaner PRE/LIVE:
- dodaje `external_fixture_id` do `tips`,
- dodaje brakujące kolumny realnych meczów,
- widoki rozdzielają LIVE i PRE,
- automatycznie dopisuje brakujące ligi,
- wymusza tylko realne mecze z `ai_source='real_ai_engine'` i `source='live_ai_engine'`.

W Supabase uruchom:
`supabase/version_145_pre_matches_external_fixture_fix.sql`
