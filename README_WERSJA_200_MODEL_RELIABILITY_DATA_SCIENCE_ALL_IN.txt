BET+AI — WERSJA 200 MODEL RELIABILITY + DATA INTEGRITY + DATA SCIENCE ALL-IN
==========================================================================

Pakiet rozwija WERSJĘ 180. Wszystkie wcześniejsze moduły zostają zachowane.
Wdrożenie: jeden SQL + jedna paczka Netlify.

NOWE MODUŁY V181–V190
---------------------
V181 Anti Data Leakage Guard
- blokuje zapis prognozy po kickoffie,
- sprawdza generatedAt, fixtureId, drużyny i termin,
- zdarzenia naruszeń trafiają do match_integrity_events.

V182 Prediction Freeze Ledger
- każdy poprawny pre-match capture dostaje SHA-256 freeze_hash,
- append-only tabela match_prediction_freeze_ledger,
- UPDATE i DELETE istniejącego wpisu są blokowane triggerem,
- główny snapshot nadal może poprawiać jakość PRZED kickoffem, ale wcześniejsze wersje zostają w ledgerze.

V183 Fixture / Settlement Integrity
- duplicate key dla fixture,
- audyt reschedule,
- settlement_count / freeze_count,
- audyt nazw drużyn przy settlement,
- settlement pozostaje idempotentny dzięki existing settled_at guard.

V184 Season Boundary Engine
- sezon piłkarski liczony od lipca,
- historia nie jest traktowana jednakowo między sezonami.

V185 Odds History & CLV 2.0
- wykorzystuje istniejący match_odds_history,
- ostatni zapis pre-kickoff = closing proxy,
- qualified CLV tylko jeśli kurs został zapisany blisko kickoffu,
- system NIE udaje pełnego closing line, jeśli brak kursu blisko startu.

V186 Overfitting Guard
- learned weights mają shrinkage do bezpiecznych wag bazowych,
- mniejsze limity zmian wag,
- mała próbka nie może tworzyć ekstremalnego modelu.

V187 Probability Stability
- porównuje Champion vs Challenger,
- mierzy max/avg delta prawdopodobieństw,
- robi małą perturbację xG w Dixon-Coles i mierzy wrażliwość wyniku.

V188 Abstention Engine
- ALLOW / WATCH / NO_PREDICTION,
- model może odmówić prognozy przy złych danych / leakage / skrajnej niestabilności.

V189 Decision Quality Lab
- Brier,
- log loss,
- CLV sample / positive CLV,
- abstention count / rate.

V190 Reliability Control Center
- liczba frozen predictions,
- leakage blocks,
- duplicate fixtures,
- settlement integrity,
- HEALTHY / WATCH / CRITICAL.

NOWE MODUŁY V191–V200
---------------------
V191 Log Loss
- dodatkowa funkcja jakości probabilities obok Brier Score.

V192 Isotonic Calibration
- monotoniczna kalibracja PAV,
- aktywowana tylko po out-of-sample improvement.

V193 Platt Calibration
- logistic calibration na logit(probability),
- parametry a/b uczone wyłącznie na rozliczonej historii.

V194 Bayesian League Priors
- global prior + league posterior,
- małe ligi są automatycznie shrinkowane do globalnego profilu.

V195 Hierarchical Shrinkage
- league-specific calibration jest mieszana z globalem zależnie od sample size.

V196 Season Decay
- current season: 1.00,
- previous: 0.55,
- 2 seasons ago: 0.25,
- older: 0.12,
- dodatkowo pozostaje exponential recency half-life 90 dni.

V197 Ensemble Stacking
- na historii komponentów Challenger liczone są jakości źródeł,
- stacking jest używany tylko, gdy Challenger już wygrał governance ORAZ Data Science OOS wybierze CALIBRATED_STACK,
- zastosowany jest konserwatywny blend 35% stacking / 65% bazowy Challenger.

V198 Out-of-Sample Walk-Forward Model Selection
- binary markets: RAW vs PLATT vs ISOTONIC,
- 1X2: RAW vs TEMPERATURE,
- profile są fitowane na przeszłości i oceniane na kolejnych blokach,
- wymagany OOS log-loss lift >= 0.003, inaczej RAW.

V199 Bootstrap Confidence
- 180 deterministic bootstrap resamples,
- 95% CI dla Brier,
- HIGH / MEDIUM / LOW confidence.

V200 Automatic Model Selection
- wybiera BASE albo CALIBRATED_STACK na podstawie OOS validation,
- nie omija Champion/Challenger governance,
- kalibracja per market jest aktywna dopiero po minimalnych próbkach.

MINIMALNE PRÓBKI
----------------
Binary Platt/Isotonic: minimum 80 obserwacji, minimum 60 train.
1X2 Temperature: minimum 100 obserwacji, minimum 80 train.
Frontend stosuje profile dopiero od 60/80 samples zależnie od rynku.
AutoSelection wymaga minimum 120 historycznych meczów oraz >=3 validated markets.

SUPABASE
--------
Uruchom:
SUPABASE_RUN_ONCE_WERSJA_200_MODEL_RELIABILITY_DATA_SCIENCE_ALL_IN.sql

Nowe tabele:
- match_prediction_freeze_ledger
- match_fixture_integrity
- match_integrity_events
- match_data_science_profiles

NETLIFY
-------
Wgraj całą paczkę WERSJA 200.
Nie dołączono node_modules. Netlify powinien wykonać czystą instalację z package-lock.json.

TESTY WYKONANE
--------------
1. node --check:
- netlify/functions/save-match-prediction.js — OK
- netlify/functions/settle-match-prediction-snapshots.js — OK
- netlify/functions/get-match-prediction-performance.js — OK

2. TypeScript parser/transpile:
- src/MatchSimulatorPreparationView.jsx — 0 parse/transpile errors
- src/predictionLabV200.js — 0 parse/transpile errors

3. TEST_WERSJA_200_RELIABILITY_DATA_SCIENCE.cjs — OK
- log loss,
- Platt,
- isotonic,
- temperature,
- bootstrap 95%,
- Bayesian priors,
- automatic selection.

4. V180 regression test — OK
- auto-promote nadal działa,
- auto-rollback nadal działa.

UWAGA O BUILDZIE
----------------
Pełny lokalny npm ci nie został ukończony w środowisku roboczym (timeout transportu podczas pobierania zależności),
dlatego nie oznaczamy pełnego Vite build jako zweryfikowanego. Składnia frontend/backend i testy logiki powyżej przeszły poprawnie.

WAŻNE
-----
To nadal system probabilistyczny. BET/WATCH/NO BET nie oznacza gwarancji wyniku ani zysku.
NO_PREDICTION jest celową funkcją bezpieczeństwa modelu, nie błędem.
