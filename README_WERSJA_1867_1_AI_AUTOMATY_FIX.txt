WERSJA 1867.1 — naprawa generatorów AI na bazie ostatniej dobrej wersji 1867

Najważniejsze poprawki:
- przycisk „Odśwież dziś” w Typach AI korzysta teraz z aktywnego generatora BetAI MultiSport AI,
- generator zapisuje równolegle do tabel tips oraz ai_bets,
- istniejący świeży typ w cooldownie jest synchronizowany do ai_bets zamiast znikać z ekranu,
- ekran po skanie pokazuje liczbę sprawdzonych meczów, meczów z kursami i kandydatów,
- jeśli typ dotyczy jutra, widok automatycznie przełącza się na jutro,
- BetAI MultiSport AI skanuje 5 razy dziennie i ma domyślny cooldown 12 godzin,
- filtry BetAI MultiSport AI zostały umiarkowanie poluzowane, bez publikowania losowych typów,
- filtry Typer Expert i Ograć Buka zostały umiarkowanie poluzowane,
- nadal obowiązuje blokada jednego aktywnego typu dla profili progresyjnych,
- nie zmieniono logiki logowania, Supabase Auth, Stripe ani istniejących rozliczeń.

Wymagania Netlify:
- SUPABASE_URL lub VITE_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- APISPORTS_KEY lub API_FOOTBALL_KEY

SQL:
- brak nowego SQL; wersja korzysta z istniejących tabel tips, ai_bets oraz ai_pick_runs.

Build:
- node --check dla trzech generatorów: OK
- npm run build: OK
