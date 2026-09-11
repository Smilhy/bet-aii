BET+AI — WERSJA 347 — FM AI MODEL INTELLIGENCE CENTER
========================================================

Zakres zmian: WYŁĄCZNIE zakładka FM AI / Symulator AI oraz funkcje backendowe obsługujące tę zakładkę. Pozostała logika i pozostałe zakładki strony nie były zmieniane.

NOWOŚCI V347
1. CLV TRACKER
   - zapis kursu sygnału Daily Scanner do match_odds_history,
   - automatyczne snapshoty T24H / T6H / T1H / T15M także dla Value Scanner,
   - settlement oblicza OPEN -> CLOSE i CLV%,
   - CLV jest uwzględniany w Model Health.

2. MODEL HEALTH DASHBOARD
   - sample size, hit rate, ROI, Brier Score, calibration error, CLV,
   - LAST 30 / 100 / 500,
   - status GOOD / WARNING / BAD / COLLECTING,
   - ostrzeżenia o drift / słabej kalibracji / negatywnym CLV.

3. WHY AI?
   - modal z czynnikami wspierającymi prognozę i ryzykami,
   - pokazuje edge, EV, reliability, market consensus i stan drift/trust.

4. RED FLAG / NO BET ENGINE
   - wspólna polityka VALUE_POLICY_V347 dla Daily Scanner i pełnej analizy,
   - blokady m.in. przy: niskim Data Quality, małej próbce, POOR calibration, niskim model agreement, market disagreement, model drift i niskim League/Market Trust,
   - STRONG VALUE wymaga co najmniej 100 prób kalibracyjnych i model agreement >=65%.

5. MARKET CONSENSUS
   - no-vig probability liczona osobno dla każdego bukmachera,
   - consensus agreement, średnia i mediana no-vig, range, min/max kurs oraz quote list.

6. PERFORMANCE BREAKDOWN
   - rynki, ligi, zakresy kursów, confidence i edge,
   - hit rate i ROI w każdej grupie.

7. AI PREDICTION TIMELINE
   - WHY AI pokazuje sygnał skanera oraz kolejne snapshoty ceny/modelu,
   - replay endpoint łączy Value Scanner, freeze ledger, odds timeline i odds history.

8. TOP PICKS 2.0
   - BEST VALUE — najwyższe EV,
   - BEST QUALITY — najwyższa reliability,
   - BEST BALANCE — edge + EV + reliability + market consensus + league trust + red flag penalty,
   - TOP 5 zachowuje osobny status VALUE / STRONG VALUE / NO BET.

WAŻNE
- STRONG VALUE i VALUE nie oznaczają pewnej wygranej.
- Model Health oraz CLV potrzebują rozliczonych meczów i rosnącej próbki historycznej.
- Brak wymaganej historii nie jest zastępowany sztucznym confidence — system przechodzi w COLLECTING / PENDING / NO BET.
- Nie jest wymagany nowy SQL, jeśli wcześniej wdrożone były tabele V146/V211 używane przez match_odds_history i match_odds_timeline.

Wersja: 347.0.0
