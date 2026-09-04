BET+AI — WERSJA 211 PRODUCTION AI OPERATIONS + REPLAY LAB ALL-IN
================================================================

Pakiet rozwija WERSJĘ 200. Nie zmienia matematycznego rdzenia prognozy V200 — dodaje
warstwę produkcyjną, monitoring, automatyzację, prawdziwszy CLV i Replay Lab.
Wdrożenie: JEDEN SQL + JEDNA paczka Netlify.

NOWE MODUŁY V201–V211
---------------------
V201 Scheduled Odds Snapshots
- nowa scheduled function: capture-match-odds-timeline,
- uruchamia się co 15 min,
- obserwuje TYLKO fixture posiadające już pre-match prediction snapshot,
- zapisuje kursy w oknach T-24h / T-6h / T-1h / T-15m,
- jedno okno dla fixture jest pobierane tylko raz,
- używa istniejącego Rate Limit Shield i osobnego scope odds-timeline,
- twardy wewnętrzny limit: 120 realnych requestów / dzień dla timeline,
- nie odpytuje API, gdy dany fixture/window jest już zapisany.

V202 True Closing Line
- settlement preferuje najbliższy automatyczny timeline snapshot przed kickoffem,
- T-15m jest closing candidate,
- jeśli timeline nie istnieje, system wraca do dotychczasowego match_odds_history,
- w settlement.clv zapisywane jest źródło closing line.

V203 Automatic Settlement Telemetry
- dotychczasowy settlement cron pozostaje aktywny,
- każdy run zapisuje checked / settled / void / pending / errors do match_ops_runs,
- brak podwójnego settlementu: istniejący guard settled_at pozostaje bez zmian.

V204 Nightly Model Rebuild
- nightly-match-model-rebuild uruchamia się codziennie 03:07,
- przelicza performance, self-learning, OOS calibration i Data Science profiles,
- zapisuje telemetry runu oraz aktualizuje Canary State,
- korzysta wyłącznie z wcześniej rozliczonej historii Supabase.

V205 Model Canary Mode
- match_model_canary_state,
- SHADOW / READY / PROMOTED / ROLLBACK / PAUSED,
- domyślnie 0% exposure, dopóki candidate nie przejdzie historii/governance,
- dashboard pokazuje shadow samples i exposure.

V206 Data Anomaly Monitor
- hourly scan bez requestów API-Football,
- wykrywa m.in. invalid team identity, invalid fixture date, xG outlier,
  błędną sumę 1X2, probability poza 0–100, settled-without-score,
  missing model version i bardzo niską data quality,
- anomalie zapisuje do match_data_anomalies.

V207 API Health Monitor
- Rate Limit Shield zapisuje zdarzenia RATE_LIMIT / HTTP_ERROR / TIMEOUT /
  BUDGET_BLOCK / QUEUE_WAIT,
- Operations Control Center pokazuje zdarzenia 24h, dzienny internal budget,
  ostatni cache update i stan systemu.

V208 Prediction Reproducibility
- nowe freeze capture'y dostają canonical_hash_v211 SHA-256,
- hash używa kanonicznego JSON (sortowanie kluczy), więc można go zweryfikować
  po odczycie JSONB z Supabase,
- stare V182 hash pozostają LEGACY_UNVERIFIABLE — nie są fałszywie oznaczane jako błędne,
- Replay pokazuje selected freeze hash, model, input weights i decyzję.

V209 Performance Explorer
- endpoint: get-match-performance-explorer,
- filtry: liga, okres, market, model, min data quality, min edge,
  min confidence, odds range,
- UI: GLOBAL / aktualna liga / 30 dni + rynek,
- liczy realne Brier / accuracy / ROI / CLV na settled historii.

V210 Operations Control Center
- API Health,
- Internal API Budget,
- Settlement Queue,
- True Closing Coverage,
- Frozen Predictions,
- Data Anomalies,
- Model Canary,
- Last Model Rebuild.

V211 Replay Lab
- endpoint get-match-replay,
- łączy Freeze Ledger + Odds Timeline + settlement,
- pokazuje timeline T-24h / T-6h / T-1h / T-15m,
- pokazuje line movement dla rynku finalnej decyzji,
- odtwarzanie NIE wykonuje requestów API-Football i NIE korzysta z danych z przyszłości.

NOWE TABELE / ZMIANY SUPABASE
-----------------------------
- match_odds_timeline
- match_ops_runs
- match_model_canary_state
- match_data_anomalies
- match_api_health_events
- match_prediction_freeze_ledger.canonical_hash_v211
- match_odds_history.capture_window
- match_odds_history.capture_source

NOWE NETLIFY FUNCTIONS
----------------------
- capture-match-odds-timeline.js
- nightly-match-model-rebuild.js
- match-ops-anomaly-scan.js
- get-match-operations-status.js
- get-match-replay.js
- get-match-performance-explorer.js

NOWY FRONTEND
-------------
- src/MatchOperationsV211.jsx
- Operations Control Center
- Performance Explorer
- Prediction Reproducibility + Replay Lab

HARMONOGRAM
-----------
- capture-match-odds-timeline: */15 * * * *
- nightly-match-model-rebuild: 7 3 * * *
- match-ops-anomaly-scan: 23 * * * *
- settle-match-prediction-snapshots: istniejący 31 * * * *

WAŻNE O API
-----------
V201 jako jedyny nowy moduł może generować requesty API-Football, ponieważ prawdziwy
ruch kursu wymaga ponownego odczytu /odds. Jest ograniczony:
- tylko do już śledzonych fixture,
- tylko w czterech konkretnych oknach,
- maks. 120 realnych requestów dziennie dla odds-timeline,
- dodatkowo nadal obowiązuje globalny Match Simulator API Budget Guard.
Pozostałe V204/V206/V208/V209/V210/V211 działają z Supabase / zapisanej historii.

WDROŻENIE
---------
1. Supabase SQL Editor -> uruchom raz:
   SUPABASE_RUN_ONCE_WERSJA_211_PRODUCTION_AI_OPERATIONS_REPLAY_ALL_IN.sql
2. Wgraj całą paczkę WERSJA 211 na Netlify.
3. Po pierwszym deployu Operations Control Center może chwilowo pokazywać COLLECTING.
   Timeline T-24/T-6/T-1/T-15 pojawi się dopiero, gdy realne przyszłe mecze przejdą
   przez te okna czasowe.

TESTY WYKONANE
--------------
- node --check: wszystkie nowe funkcje + patched settlement/rate shield — OK
- TypeScript transpile parser:
  src/MatchSimulatorPreparationView.jsx — 0 błędów
  src/MatchOperationsV211.jsx — 0 błędów
- TEST_WERSJA_211_PRODUCTION_OPS_REPLAY.cjs — TEST_V211_OK
  * snapshot window routing
  * anomaly detection
  * explorer filters
  * canonical SHA-256 replay verification

PEŁNY VITE BUILD
----------------
Nie wykonano pełnego npm build w środowisku roboczym, ponieważ npm cache nie posiada
vite-8.1.4, a tryb offline zwrócił ENOTCACHED. Finalny ZIP nie zawiera node_modules;
Netlify powinien wykonać czystą instalację z package-lock.json.

UWAGA
-----
To nadal system probabilistyczny. Monitoring, backtest, CLV i Replay poprawiają
kontrolę jakości, ale nie gwarantują trafności ani zysku.
