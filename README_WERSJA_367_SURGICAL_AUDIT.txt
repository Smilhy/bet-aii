BET+AI WERSJA 367 — FM AI SURGICAL AUDIT

Zakres:
- spójny FM AI snapshot: Top Typ -> Dlaczego AI -> Pełna analiza -> Symulator
- normalizacja nazw rynków (1X2, O/U 1.5/2.5/3.5, BTTS)
- hard guard tylko dla VALUE/STRONG VALUE >= 55%
- NO BET nie wymusza scenariusza symulatora
- synchronizacja xG z rynkami bramkowymi i BTTS
- korekta wyboru Top Typu i opisów WHY AI
- cache schema bump, aby nie ładować starych wyników po wdrożeniu
- pełny skan wszystkich widocznych meczów + działający refresh
- zachowane poprawki UI / spacing / herby z poprzednich wersji

Regression tests wykonane przed spakowaniem:
- TEST_WERSJA_347_FM_AI_MODEL_INTELLIGENCE.cjs — OK
- TEST_WERSJA_352_FM_AI_PERSISTENT_CACHE.cjs — OK
- TEST_WERSJA_353_MASTER_CONSENSUS.cjs — OK
- TEST_WERSJA_320_REALISTIC_MATCH_ENGINE.mjs — OK
- TEST_WERSJA_200_RELIABILITY_DATA_SCIENCE.cjs — OK
- TEST_WERSJA_260_MATCH_CONTEXT_MARKET_MEMORY.cjs — OK
- TEST_WERSJA_367_FM_AI_CONSISTENCY.mjs — OK (11 rynków x 48 scenariuszy)

Uwaga: pełny produkcyjny build Vite nie był uruchamiany lokalnie w tym środowisku, ponieważ paczka nie zawiera node_modules. Testy logiki/regresji przeszły.
