# BetAI Wersja 7 — automatyczne rozliczanie Typów AI

## Znaleziony błąd

Nowy publisher zapisuje rekordy w `public.ai_bets` z polem:

`source = betai_independent_value_v1867_9`

Funkcja `settle-live-ai-picks` przepuszczała tylko rekordy zawierające tekst
`BetAI MultiSport AI` / `multisportai`. Z tego powodu aktualne rekordy były
odrzucane przed sprawdzeniem wyniku (`checked=0`) i pozostawały `PENDING`.

## Poprawki

- rozpoznawanie `betai_independent_value_*` oraz historycznych źródeł BetAI,
- jawne wykluczenie Typer Expert i Ograć Buka,
- harmonogram settlementu zmieniony z 4 uruchomień dziennie na co godzinę,
- odpowiedź funkcji zawiera diagnostykę: `rowsLoaded`, `recognizedRows`,
  `candidates`, `ignoredBySource`,
- test regresji dla meczu LDU Quito — Orense SC, typ Powyżej 2.5 gola.

Po wdrożeniu otwarcie zakładki Typy AI albo kliknięcie „Rozlicz zakończone”
uruchomi naprawioną funkcję. Kolejne automatyczne uruchomienia wykonuje Netlify
co godzinę o minucie 17.
