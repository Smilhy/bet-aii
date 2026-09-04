Bet+AI WERSJA 280 — LIVE PRE-MATCH INTELLIGENCE + ALERTS / USER WORKFLOW ALL-IN

BAZA
- Pakiet jest bezpośrednią kontynuacją WERSJI 260.
- Nie usuwa modułów V136–V260.
- V260 pozostaje zamrożonym baseline forecastem; V280 dokłada audytowalną warstwę ostatnich 2 godzin przed kickoffem.

V261–V270 LIVE PRE-MATCH INTELLIGENCE
V261 Lineup Confirmation Engine
- Scheduler sprawdza /fixtures/lineups w oknach T-120, T-90, T-60, T-45, T-30, T-15.
- Po potwierdzeniu obu XI pomija zbędne odczyty T-45/T-30 i robi jeszcze kontrolę T-15.
- Porównuje oficjalny XI z zamrożonym baseline, jeśli baseline jest wiarygodny.

V262 Last-Minute Change Detector
- wykrywa rotację XI, zmianę GK, zmianę ustawienia i nowe absencje graczy z baseline XI.
- niczego nie zgaduje, gdy baseline XI nie istnieje.

V263 Pre-Match Re-Score
- tworzy osobną warstwę re-score, nie przepisuje historycznej prognozy.
- korekta korzysta z xG baseline + lineup/GK/new injury + weather/referee/travel.
- wynik jest ponownie przeliczany przez rozkład bramek i kontrolowany blend z baseline.

V264 Probability Delta
- pokazuje probability BEFORE -> AFTER i delta pp dla rynku decyzji.

V265 Weather Context
- Open-Meteo Geocoding + Forecast; nie zużywa API-Football i nie wymaga klucza.
- wiatr/opady/skrajna temperatura mają ograniczony, jawny wpływ.
- brak pogody = wpływ dokładnie 0.

V266 Referee Context
- profil sędziego buduje się WYŁĄCZNIE z zakończonych wcześniej śledzonych spotkań.
- karty/faule/statystyki są pobierane po meczu z limitem 36 requestów API-Football/dzień.
- profil zaczyna wpływać dopiero od minimum 12 próbek.

V267 Travel & Rest Intelligence
- odległość jest liczona tylko gdy Bet+AI zna bazę miasta drużyny z wcześniejszych śledzonych meczów domowych.
- geocoding jest cacheowany w Supabase.
- zwykły rest/congestion nadal pochodzi z V260, żeby nie liczyć go dwa razy.

V268 Confidence Change Alert
- HIGH/MEDIUM/LOW before -> after.

V269 Decision Change Log
- chronologiczna historia BET/WATCH/NO_BET przed kickoffem.

V270 Live Pre-Match Control Center
- TRACKED, READY, REVIEW, XI CONFIRMED, MODEL MOVED, MARKET MOVED.
- flagi LINEUP_CONFIRMED / MAJOR_CHANGE / MODEL_MOVED / MARKET_MOVED / REVIEW_REQUIRED.

V271–V280 ALERTS + USER WORKFLOW
V271 prywatna watchlista dla użytkownika Supabase Auth.
V272 reguły alertów: XI, major change, decision, confidence, probability delta, market delta.
V273 alerty zmian zapisywane do inboxu użytkownika.
V274 Save Analysis — snapshot bieżącej analizy do Supabase.
V275 Before vs After — porównanie baseline i Live Pre-Match.
V276 Decision History — timeline decyzji/probability/xG.
V277 Daily Digest — dzienny snapshot watchlisty.
V278 Alert Inbox + opcjonalne browser notifications podczas otwartej aplikacji.
V279 User Workflow Dashboard.
V280 All-In Control Center.

NOWE NETLIFY FUNCTIONS
- capture-live-prematch-v280.js
- rebuild-referee-intelligence-v280.js
- get-live-prematch-v280.js
- get-live-prematch-control-center-v280.js
- match-user-workflow-v280.js
- build-daily-prematch-digest-v280.js

NOWE SCHEDULE
- capture-live-prematch-v280: 8,23,38,53 * * * *
- rebuild-referee-intelligence-v280: 51 * * * *
- build-daily-prematch-digest-v280: 17 7 * * *

API SAFETY
- prematch-live-v280 ma twardy scope budget: maks. 140 realnych requestów API-Football/dzień.
- referee-v280 ma twardy scope budget: maks. 36 realnych requestów API-Football/dzień.
- wszystkie scope'y respektują globalny Match Simulator budget 750.
- cache hits nie zużywają budżetu.
- po potwierdzeniu obu XI ograniczamy kolejne odczyty lineupów.
- pogoda/geocoding korzystają z Open-Meteo, nie z API-Football.

WAŻNE O ALERTACH
- In-app alerts działają przez Supabase.
- Browser Notification działa podczas otwartej aplikacji po zgodzie użytkownika.
- Ten pakiet NIE udaje zewnętrznego push/email. Do alertów przy całkowicie zamkniętej przeglądarce potrzebny byłby osobny provider (np. Web Push/FCM/email) i osobna konfiguracja domeny/kluczy.

WDROŻENIE
1. Supabase -> SQL Editor -> uruchom raz:
   SUPABASE_RUN_ONCE_WERSJA_280_LIVE_PREMATCH_ALERTS_ALL_IN.sql
2. Wgraj cały ZIP na Netlify.
3. Nie dodawaj node_modules do ZIP. Netlify wykonuje npm install z package-lock.json.
4. Istniejące ENV Supabase/API-Football pozostają bez zmian. Open-Meteo nie wymaga ENV.

OCZEKIWANE ZACHOWANIE PO WDROŻENIU
- Jeśli kickoff jest dalej niż 2h: V280 pokazuje TRACKING/WAIT.
- Od T-120 zaczynają powstawać live pre-match checks.
- Sędzia może przez dłuższy czas pokazywać TRACKING 0/12, ponieważ profil musi zebrać prawdziwą historię.
- Travel może początkowo być UNKNOWN, dopóki drużyny nie zbudują bazy lokalizacji z wcześniejszych śledzonych meczów domowych.
- Brak danych nie powoduje sztucznej kary/bonusu.

TESTY W PACZCE
- TEST_WERSJA_280_LIVE_PREMATCH_ALERTS.cjs
- istniejący TEST_WERSJA_260_MATCH_CONTEXT_MARKET_MEMORY.cjs
- istniejący TEST_WERSJA_200_RELIABILITY_DATA_SCIENCE.cjs

Wersja: 280.0.0
