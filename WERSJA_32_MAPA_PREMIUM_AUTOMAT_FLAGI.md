# WERSJA 32 — Mapa premium + automatyczne flagi

Zmiany:
- premium wygląd zakładki Mapa świata na wzór przesłanego projektu,
- statystyki: dzisiaj, tydzień, miesiąc, kraje, lista krajów i ostatnie rejestracje,
- ręczny override: buchajson1988, p.kucharski, smilhytv = Wielka Brytania,
- obecne konta bez kraju można uzupełnić SQL-em na Polskę,
- nowe konta zapisują kraj automatycznie przy logowaniu / rejestracji,
- funkcja record-profile-country nie nadpisuje już ręcznie ustawionego kraju.

SQL do uruchomienia raz:
SUPABASE_RUN_ONCE_WERSJA_32_WORLD_MAP_FLAGS_BACKFILL.sql

Nie ruszano typów, botów, progresji, płatności ani schematu typów.
