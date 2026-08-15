# WERSJA 10 — odzyskiwanie fixture_id dla botów

## Potwierdzony błąd
Zapisywanie typu miało awaryjny tryb zgodności ze schematem Supabase. Gdy brakowało dowolnej opcjonalnej kolumny, tryb ten usuwał również `fixture_id`, `api_fixture_id`, `external_fixture_id`, `market_key` i `selection_key`. Typ był widoczny jako PENDING, ale funkcje Typer Expert i Ograć Buka nie miały identyfikatora potrzebnego do pobrania wyniku.

## Naprawa
- identyfikatory meczu i klucze rynku są zachowywane przy zapisie nowych typów,
- brakujące kolumny są usuwane pojedynczo, zamiast przechodzenia na zbyt ubogi rekord,
- funkcje rozliczające stare rekordy bez ID wyszukują mecz po dacie oraz nazwach drużyn,
- odzyskany ID jest zapisywany z powrotem do `tips`,
- dołączony SQL próbuje od razu odzyskać ID z `ai_bets` i `sports_fixture_cache`.

## Kolejność
1. Uruchom `SUPABASE_RUN_ONCE_WERSJA_10_FIXTURE_ID_RECOVERY.sql`.
2. Wdróż cały projekt przez Git lub Netlify CLI.
3. Kliknij `Rozlicz zakończone`.
