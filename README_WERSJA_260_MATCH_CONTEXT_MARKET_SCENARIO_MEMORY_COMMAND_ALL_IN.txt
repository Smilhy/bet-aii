BET+AI — WERSJA 260 ALL-IN
MATCH CONTEXT + MARKET INTELLIGENCE + SCENARIO LAB + SIMILAR MATCH MEMORY + AI COMMAND CENTER

BAZA: WERSJA 211
INSTALACJA: 1 SQL + 1 deploy ZIP na Netlify

============================================================
CO DODAJE V212–V220 — MATCH CONTEXT ENGINE 4.0
============================================================
V212 Lineup Continuity
- porównuje obecny XI z ostatnim PRE-MATCH XI zapisanym dla tej samej drużyny,
- pierwszy śledzony mecz ma status TRACKING,
- od kolejnych meczów pokazuje retained/11 i liczbę zmian.

V213 Player Importance
- nie używa fikcyjnych ratingów,
- absencja jest ważniejsza, jeśli zawodnik był w poprzednim śledzonym XI,
- pozycja daje bezpieczny mnożnik wpływu (GK/F/D/M), ale nie jest udawanym ratingiem gracza.

V214 Goalkeeper Intelligence
- wykrywa zmianę bramkarza względem poprzedniego śledzonego XI,
- zmiana GK jest sygnałem kontekstowym i może delikatnie zmienić xG przeciwnika.

V215 Manager Change Engine
- wykorzystuje coach z realnego lineup API, gdy jest dostępny,
- poprzedni trener jest pamiętany w Supabase,
- zmiana trenera zwiększa uncertainty i obniża zaufanie do starej formy.

V216 Tactical Matchup
- home recent attack vs away recent defence,
- away recent attack vs home recent defence,
- fallback do season team statistics.

V217 Set Piece Intelligence SAFE
- system NIE wymyśla rożnych/wolnych,
- jeśli brak wiarygodnych danych, pokazuje NO_RELIABLE_DATA i wpływ xG = 0,
- ograniczony penalty signal jest informacyjny, nie jest traktowany jako pełne set-piece xG.

V218 Schedule Stress 2.0
- rest days,
- matches/7d,
- mecze pucharowe/14d,
- AET/PEN w ostatnich meczach,
- zmiany miast jako ostrożny travel proxy, bez udawania kilometrów.

V219 Context Shock Detector
- manager change,
- goalkeeper change,
- 3–6+ zmian XI,
- wielu poprzednich starterów OUT,
- high schedule stress,
- early-season context.

V220 Context Adjusted xG
- nowa warstwa jest nakładana po Champion/Challenger + stacking, ale przed calibration,
- overlay ma kontrolowaną wagę ~18–35%,
- nie dubluje zwykłego injury-count / fatigue z V180,
- finalne probability i Value Engine korzystają z context-adjusted raw probabilities.

============================================================
V221–V230 — MARKET INTELLIGENCE 3.0
============================================================
- Bookmaker Consensus,
- Market Dispersion,
- Steam / Drift Detector,
- Reverse Move Detector,
- Stale Odds Detector,
- Model vs Market Timeline,
- True Price Band foundation,
- Market Stability,
- Market Confirmation,
- Market Radar.

Dane pochodzą z V201 Odds Timeline (T-24h/T-6h/T-1h/T-15m).
Ten panel sam NIE robi nowych requestów API-Football.

============================================================
V231–V238 — WHAT-IF / SCENARIO LAB
============================================================
Presety:
- NORMAL,
- HOME kluczowy napastnik OUT,
- AWAY kluczowy napastnik OUT,
- zmiana GK HOME/AWAY,
- duża rotacja XI HOME/AWAY,
- wysoki fatigue HOME/AWAY.

Każdy scenariusz przelicza:
- xG,
- 1/X/2,
- Over 1.5/2.5/3.5,
- BTTS,
- top score.

WAŻNE: to są jawnie oznaczone testy wrażliwości. Nie oznaczają, że dany zawodnik faktycznie nie zagra.

============================================================
V239–V245 — AI MATCH REPORT
============================================================
- 30-second report,
- expert report,
- reasons,
- risks,
- what can change the prediction,
- no-hallucination guard.

Raport jest generowany deterministycznie z danych modelu/context/market.
Nie potrzebuje OpenAI API i nie wymyśla liczb.

============================================================
V246–V252 — SIMILAR MATCH MEMORY
============================================================
- buduje sygnaturę bieżącego meczu,
- szuka do 3000 WYŁĄCZNIE WCZEŚNIEJSZYCH, ROZLICZONYCH prognoz,
- uwzględnia 1X2, O2.5, BTTS, xG, Data Quality, kurs i ligę,
- league-aware similarity,
- zwraca top historycznych sąsiadów,
- agreguje Home Win / Draw / Away / O2.5 / BTTS / avg score,
- minimum 15 podobnych przypadków do aktywnego wyniku,
- cache 12 h w Supabase.

Anti-leakage:
- current fixture jest wykluczony,
- fixture_date historycznego meczu musi być wcześniejszy niż bieżący kickoff,
- wymagany jest realny settled score.

============================================================
V253–V260 — AI COMMAND CENTER
============================================================
BET+AI TODAY pokazuje:
- fixtures tracked,
- fully analysed,
- BET / WATCH / NO BET,
- top confidence,
- top edge,
- risk radar,
- active model,
- data integrity,
- API health,
- production readiness score.

============================================================
SUPABASE
============================================================
URUCHOM RAZ:
SUPABASE_RUN_ONCE_WERSJA_260_MATCH_CONTEXT_MARKET_SCENARIO_MEMORY_COMMAND_ALL_IN.sql

Nowe tabele:
- match_team_context_registry_v260
- match_context_events_v260
- match_context_snapshots_v220
- match_similarity_cache_v252
- match_command_center_daily_v260

RLS jest włączony. Brak publicznych policies jest celowy.
Netlify Functions używają SUPABASE_SERVICE_ROLE_KEY.

============================================================
NOWE FUNKCJE NETLIFY
============================================================
- get-team-context-v260.js
- get-similar-match-memory-v252.js
- get-ai-command-center-v260.js

Zmienione:
- get-match-simulator-data.js
- save-match-prediction.js

Frontend:
- matchIntelligenceV260.js
- MatchIntelligenceV260.jsx
- MatchSimulatorPreparationView.jsx
- styles.css

============================================================
API-FOOTBALL
============================================================
V212–V260 nie dodaje nowych cyklicznych requestów API-Football.
Korzysta z danych, które V211 już pobiera:
- fixtures,
- recent fixtures,
- lineups,
- injuries,
- team statistics,
- odds timeline V201.

get-team-context, memory i command center czytają Supabase.

============================================================
TESTY W PAKIECIE
============================================================
TEST_WERSJA_260_MATCH_CONTEXT_MARKET_MEMORY.cjs

Sprawdzono:
- node --check nowych/zmienionych Netlify Functions,
- TypeScript transpile/parser dla nowych plików JSX/JS i MatchSimulatorPreparationView,
- test Similar Match Memory.

Pełny npm build zależy od instalacji zależności Vite na środowisku deploy.
ZIP nie zawiera node_modules; Netlify ma wykonać czyste npm install z package-lock.json.
