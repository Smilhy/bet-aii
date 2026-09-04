BET+AI — WERSJA 180 SELF LEARNING AI + MATCH INTELLIGENCE 3.0 ALL-IN
====================================================================

Pakiet jest bezpośrednim rozwinięciem WERSJI 166. Zachowuje V159–V166 i dodaje
V167–V180 w jednym wdrożeniu.

NOWE MODUŁY
-----------
V167 AUTO WEIGHT OPTIMIZER
- Uczy wagi źródeł z rozliczonej historii V180.
- Źródła: Poisson/xG, Dixon-Coles, forma, API Prediction, Web Consensus,
  Team Strength oraz Recent Goals.
- Jeżeli nie ma wystarczającej historii, używa bezpiecznych wag startowych.

V168 LEAGUE-SPECIFIC MODELS
- Osobne profile wag dla lig po zebraniu min. 30 rozliczonych meczów V180.
- Bez próbki używany jest profil globalny.

V169 MARKET-SPECIFIC MODELS
- Osobne wagi dla 1X2, Over 1.5, Over 2.5, Over 3.5 i BTTS.

V170 RECENCY LEARNING
- Exponential decay z half-life 90 dni.
- Nowsze wyniki wpływają mocniej niż starsze.

V171 FEATURE PERFORMANCE LAB
- Ranking źródeł wg rzeczywistego Brier Score.
- Status EARLY / LEARNING / PROVEN.

V172 ADAPTIVE CALIBRATION
- Dodatkowa kalibracja per rynek oraz per liga.
- 1X2 używa temperature/power calibration.
- Rynki binarne używają kontrolowanego historycznego bias correction.
- Włącza się dopiero od 30 próbek profilu.

V173 AUTO PROMOTION / ROLLBACK
- V180 jest Challengerem i nie przejmuje decyzji od razu.
- Auto-promocja: minimum 120 sparowanych wyników Champion vs V180,
  poprawa Brier >= 0.004, rolling-50 nie może przeczyć przewadze,
  brak istotnej regresji rynków.
- Po promocji watchdog kontroluje ostatnie 50 par.
- Rollback: pogorszenie rolling Brier >= 0.025 lub regresja >= 2 rynków.
- Po rollbacku jest cooldown: 60 nowych par przed ponowną promocją.
- Stan modelu jest zapisywany trwale w Supabase match_model_registry.

V174 AI MODEL BRAIN DASHBOARD
- aktywna wersja
- liczba próbek self-learning
- half-life
- ranking źródeł
- profil ligi
- status governance / rollback
- dynamiczne wagi

V175 EXPECTED LINEUPS
- Wykorzystuje istniejące oficjalne XI lub przewidywane XI z obecnego pipeline.
- Nie dodaje dodatkowych requestów API.

V176 SAFE PLAYER IMPACT
- Nie wymyśla ratingów zawodników.
- Wpływ jest ograniczony do realnie dostępnych danych: XI, liczba absencji,
  status składu i inne dane już pobrane przez Symulację AI.

V177 GK / DEFENCE PROXY
- Sprawdza, czy bramkarz jest znany w XI.
- Bez wiarygodnych indywidualnych statystyk NIE tworzy fikcyjnego ratingu GK.
- Pokazuje wyłącznie team-defence proxy z Team Strength.

V178 FATIGUE / SCHEDULE CONGESTION
- Liczy odpoczynek od ostatniego realnego meczu.
- Liczy mecze w ostatnich 7 i 14 dniach.
- LOW / MEDIUM / HIGH congestion.

V179 SAFE INJURY IMPORTANCE
- Uwzględnia realne zgłoszone absencje.
- Brak fikcyjnej wartości zawodnika bez danych.

V180 MATCH INTELLIGENCE 3.0
- Łączy XI + absencje + fatigue + Team Strength w małą, limitowaną korektę xG.
- Korekty są capowane, żeby Match Intelligence nie mógł zdominować modelu.
- Challenger V180 zapisuje pełne components do Supabase, dzięki czemu od tej
  wersji Auto Weight Optimizer może rzeczywiście mierzyć każde źródło osobno.

WAŻNE: BRAK NOWYCH REQUESTÓW API-FOOTBALL
-----------------------------------------
V167–V180 korzysta z:
- istniejącego snapshotu meczu,
- danych już pobieranych w get-match-simulator-data,
- historii rozliczonych prognoz w Supabase.

Nie dodano nowego endpointu API-Football tylko na potrzeby self-learning.

SUPABASE
--------
Najpierw uruchom RAZ:
SUPABASE_RUN_ONCE_WERSJA_180_SELF_LEARNING_MATCH_INTELLIGENCE_ALL_IN.sql

Tworzy:
- match_model_registry
- match_model_governance_events
- match_model_learning_profiles (przygotowane pod audyt/profilowanie)
- indeksy pod V180 learning

NETLIFY
-------
Po SQL wgraj całą paczkę WERSJA 180 na Netlify.
Nie wgrywaj node_modules. Netlify powinien wykonać czystą instalację z package-lock.json.

TESTY WYKONANE W PACZCE
-----------------------
1. Node syntax check:
   - get-match-prediction-performance.js
   - save-match-prediction.js
   - settle-match-prediction-snapshots.js

2. Parser TypeScript/JSX:
   - MatchSimulatorPreparationView.jsx: 0 błędów parsera
   - predictionLabV180.js: 0 błędów parsera

3. TEST_WERSJA_180_SELF_LEARNING_ENGINE.cjs:
   - 130 dobrych par -> AUTO_PROMOTED
   - scenariusz pogorszenia rolling -> AUTO_ROLLBACK

Pełny npm build nie został wykonany lokalnie, ponieważ środowisko robocze nie miało
kompletnego node_modules i npm ci nie zakończyło się poprawnie. Finalna paczka jest
celowo bez node_modules, zgodnie z normalnym deploymentem Netlify.

BEZPIECZEŃSTWO MODELU
---------------------
To nadal model probabilistyczny, nie gwarancja wyniku lub zysku. Self-learning
optymalizuje jakość prognoz historycznych (Brier/calibration), a nie obiecuje
wygranych zakładów.
