Bet+AI WERSJA 346 — FM AI VALUE CALIBRATION GUARD

Zakres zmian: WYŁĄCZNIE zakładka FM AI / Symulator AI i jej funkcje Netlify.
Pozostałe zakładki, logika strony, wygląd i funkcje nie zostały celowo zmienione.

Co poprawiono:
1. Daily Value Scanner używa historii tego samego modelu: BETAI_VALUE_SCANNER_V1.
2. Pełna analiza używa historii tego samego modelu: BETAI_FORECAST_V260.
3. Do kalibracji trafiają tylko snapshoty wygenerowane przed kickoffem i później rozliczone prawdziwym wynikiem.
4. Value Scanner po kickoffie nie tworzy i nie nadpisuje snapshotu — ostatni zapis pre-match pozostaje zamrożony.
5. Settlement zapisuje wynik także do historycznych snapshotów Value Scanner (payload.settlementV346), dzięki czemu skaner buduje własną bazę kalibracyjną.
6. Minimum 30 rozliczonych prób rynku jest wymagane do VALUE.
7. STRONG VALUE wymaga minimum 100 rozliczonych prób wybranego źródła kalibracji.
8. STRONG VALUE wymaga model agreement >= 65%.
9. STRONG VALUE wymaga Data Quality >= 88, Reliability >= 82, EV >= 8% i edge >= próg + 5 pp.
10. Daily Scanner i pełna analiza korzystają z jednej wspólnej funkcji klasyfikacji: src/valuePolicyV346.js.
11. Na kartach Daily Scanner pokazuje się źródło kalibracji: GLOBAL albo LEAGUE oraz liczba prób.
12. FAIR, no-vig, EDGE i EV pozostają liczone tak jak wcześniej — zmieniono kontrolę jakości i źródło kalibracji, nie podstawową matematykę kursów.

Ważne zachowanie po aktualizacji:
- Jeżeli nowa, poprawnie odfiltrowana historia ma mniej niż 30 prób, system pokaże PENDING / NO BET zamiast sztucznie korzystać ze starszych lub innych modeli.
- Przy 30-99 próbach mocny sygnał może być VALUE, ale nie STRONG VALUE.
- Po osiągnięciu 100+ prób STRONG VALUE jest możliwe tylko przy zgodności modeli >= 65% i pozostałych progach jakości.
- To celowo bardziej konserwatywne niż V345.

Nie jest wymagany nowy SQL do Supabase. V346 wykorzystuje istniejące tabele match_value_scan_snapshots i match_prediction_snapshots.
