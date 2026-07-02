# Wersja 9 — automatyczne rozliczanie Typer Expert i Ograć Buka

## Znaleziony błąd
Funkcje `settle-typer-expert` i `settle-ograc-buka` poprawnie pobierały wynik meczu, ale zapis do tabeli `tips` zawierał pole `settlement_reason`. W aktualnym schemacie Supabase tej kolumny nie było, więc PostgREST odrzucał cały UPDATE. Rekord pozostawał `pending`, mimo że wynik meczu był już znany.

## Naprawa
- dodano migrację tworzącą `settlement_reason` i pozostałe kolumny rozliczeń,
- zapis rozliczenia ma teraz bezpieczny fallback dla opcjonalnych/brakujących kolumn,
- najnowsze oczekujące typy są sprawdzane jako pierwsze,
- harmonogramy funkcji są spójne: Typer Expert minuta 37, Ograć Buka minuta 52,
- przycisk „Rozlicz zakończone” w Typach AI uruchamia również rozliczanie obu botów.

## Wdrożenie
1. Uruchom `SUPABASE_RUN_ONCE_WERSJA_9_BOT_SETTLEMENT_COLUMNS.sql` w Supabase SQL Editor.
2. Wdróż cały projekt na Netlify przez Git lub Netlify CLI.
3. Wejdź do Typów AI i kliknij „Rozlicz zakończone”.
