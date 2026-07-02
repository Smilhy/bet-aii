# Wersja 13 — statystyki i skuteczność AI Prediction

## Co dodano

- trwałe zapisywanie pierwszej predykcji 1X2 przed rozpoczęciem meczu,
- automatyczne rozliczanie wynikiem po 90 minutach,
- skuteczność 7 dni, 30 dni i od początku zbierania danych,
- wygrane, przegrane, oczekujące, seria W/L,
- ROI i zysk przy stałej stawce 1 jednostki,
- średni realny kurs,
- lista ostatnich rozliczonych predykcji,
- ręczne rozliczenie przy kliknięciu „Odśwież dane i statystyki”,
- harmonogram Netlify rozliczający historię co godzinę.

## Ważne

Statystyki zaczynają liczyć się od wdrożenia wersji 13. System nie dopisuje sztucznej historii. Predykcja jest zamrażana przy pierwszym zapisie przed meczem, dzięki czemu późniejsza zmiana kursów lub prawdopodobieństw nie poprawia wyniku wstecz.

## Wdrożenie

1. Uruchom `SUPABASE_RUN_ONCE_WERSJA_13_AI_PREDICTION_STATS.sql` w Supabase SQL Editor.
2. Wdróż projekt przez Git albo Netlify CLI, aby opublikować nową funkcję i harmonogram.
3. Wejdź do AI Prediction i kliknij „Odśwież dane i statystyki”.
