# BetAI 1823 — naprawa błędnych zwrotów

## Przyczyna
Parser linii odczytywał `under_1_5` jako `under 1.0`, `under_2_5` jako `under 2.0` i `over_3_5` jako `over 3.0`. Dlatego dokładnie 1, 2 albo 3 gole były błędnie oznaczane jako `void`/`Zwrot`.

## Co poprawiono
- prawidłowe odczytywanie linii 1.5, 2.5, 3.5 itd.;
- nierozpoznany rynek nie jest już automatycznie ustawiany jako zwrot;
- poprawne naliczanie profitu z dokładnością do 0.01 i domyślną stawką 1;
- automatyczna naprawa podejrzanych zwrotów wyłącznie konta BetAI MultiSport AI;
- automatyczne rozliczanie 4 razy dziennie.

## Jednorazowa naprawa historii po wdrożeniu
Otwórz:

`https://bet-ai.app/.netlify/functions/settle-live-ai-picks?force=1`

Następnie odśwież profil przez Ctrl+Shift+R.
