BetAI WERSJA 1867.7 — TRZY OSOBNE STRATEGIE, REALNIE POLUZOWANE

Zmiany:
- Każdy bot nadal ma własną taktykę, scoring, dozwolone rynki i cooldown.
- BetAI: cooldown 2 h, 1 bukmacher, próg prawdopodobieństwa 12%, edge od -4%.
- Typer Expert: cooldown 4 h, 1 bukmacher, próg 18%, prognoza API jest premią, a nie twardą blokadą.
- Ograć Buka: cooldown 4 h, kursy 1.50–5.00, 1 bukmacher, próg 12%, API jest sygnałem rankingowym.
- Dodano trzeci poziom selekcji OPEN, który wybiera realny kurs, gdy brak typu strict/fallback.
- Skan obejmuje domyślnie 3 dni i 3 strony kursów.
- Harmonogram uruchamia wspólny pobór danych 6 razy dziennie.
- Nie zmieniono logiki kont, Supabase, płatności ani wyglądu strony.

Wdrożenie: pełny deploy przez Git lub Netlify CLI, nie samo kopiowanie katalogu dist.
