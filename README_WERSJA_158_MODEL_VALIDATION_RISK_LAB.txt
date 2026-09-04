Bet+AI WERSJA 158 — MODEL VALIDATION & RISK LAB ALL-IN
========================================================

BAZA: WERSJA 152 Professional Prediction Lab.

NAPRAWIONY BŁĄD REACT #31
-------------------------
Po kliknięciu „Uruchom symulację” test V152 przekazywał trenera jako obiekt:
  { name: 'Bet+AI Lab' }
MatchSimulatorView próbował wyrenderować cały obiekt jako React child.
React production zgłaszał invariant #31: object with keys {name}.

W V158 FormationBoard renderuje teraz wyłącznie coach.name / coach.label / tekst.
Dodatkowo zabezpieczono nazwy bukmacherów, jeżeli źródło zwróci obiekt zamiast stringa.

V153 — PREDICTION AUDIT TRAIL
-----------------------------
- zapisuje pre-match audit do Supabase,
- model version,
- xG / RAW / calibrated,
- data quality,
- reliability,
- Professional Lab i Validation Lab,
- źródła, dynamic weights, factors, model inputs,
- kursy faktycznie widziane przez aplikację,
- finalną decyzję,
- SHA-256 signature, żeby nie spamować identycznymi auditami.

V154 — ERROR ANALYSIS ENGINE
----------------------------
Po rozliczeniu przegranego validated BET system zapisuje automatyczną klasyfikację:
- MODEL_DISAGREEMENT,
- MODEL_DRIFT,
- NEGATIVE_CLV,
- HIGH_UNCERTAINTY,
- LOW_DATA_QUALITY,
- MARKET_MISREAD.

V155 — ENSEMBLE MODELS
----------------------
Niezależne sygnały dla finalnego rynku:
- Bet+AI Core,
- Form / Home-Away,
- API Prediction (gdy istnieje realny % dla rynku),
- Web Consensus (gdy realnie dostępny),
- Market NO-VIG.
System pokazuje ensemble probability, fair odds, spread i agreement score.

V156 — SHARP DISAGREEMENT DETECTOR
----------------------------------
- STABLE,
- WATCH,
- SHARP.
SHARP automatycznie zmienia finalną decyzję na NO BET.
WATCH może zdegradować BET -> WATCH.

V157 — PORTFOLIO RISK SIMULATOR
-------------------------------
- wyłącznie Shadow Portfolio,
- stała stawka 1u,
- bootstrap historycznych realnych paper-bet returns,
- 1000 symulacji,
- horyzonty 50 / 100 / 250 typów,
- median ROI,
- P10 / P90 ROI,
- median drawdown,
- P90 drawdown.
Minimum 30 rozliczonych paper betów.

V158 — MODEL CONTROL CENTER
---------------------------
Jeden panel pokazuje:
- model version,
- liczbę settled forecasts,
- calibrated i RAW Brier,
- Shadow ROI,
- AVG CLV,
- drift,
- league/market trust,
- best league,
- weakest league,
- najczęstsze klasy błędów modelu.

OFFLINE TEST
------------
Przycisk na liście został przemianowany na:
  URUCHOM TEST V158

Test nadal działa przy wyczerpanym API i używa 0 requestów API-Football.
Ma przykładową historię potrzebną do pokazania nowych paneli V153–V158.
Test NIE zapisuje się do realnego Supabase/backtestu/Shadow Portfolio.

SUPABASE
--------
Uruchom raz:
  SUPABASE_RUN_ONCE_WERSJA_158_MODEL_VALIDATION_RISK_LAB.sql

Tworzy:
- public.match_prediction_audit
- public.match_prediction_error_analysis

API FOOTBALL
------------
V153–V158 nie dodaje nowych requestów do API-Football.
Ensemble/validation/risk korzystają z danych już pobranych oraz historii Supabase.

TESTY W PACZCE
--------------
- TypeScript transpile parser: MatchSimulatorPreparationView.jsx OK
- TypeScript transpile parser: MatchSimulatorView.jsx OK
- TypeScript transpile parser: MatchSimulatorDailyMatchesView.jsx OK
- node --check: save-match-prediction.js OK
- node --check: settle-match-prediction-snapshots.js OK
- node --check: get-match-prediction-performance.js OK
- test Portfolio Risk Simulator: OK
- test Error Analysis classification: OK

Pełny npm run build nie jest wykonywany lokalnie, ponieważ odziedziczona paczka ma puste/odchudzone katalogi node_modules. Netlify powinien zainstalować zależności zgodnie z package.json.
