Bet+AI — WERSJA 300 PRODUCTION PLATFORM 2.0 ALL-IN
===================================================

BAZA: WERSJA 280 LIVE PRE-MATCH + wszystkie wcześniejsze warstwy V158–V280.
Ta paczka nie usuwa historii prognoz i nie zastępuje Freeze Ledger.

CO DODAJE V281–V300
-------------------
V281–V284 WEB PUSH / NOTIFICATIONS 2.0
- Service Worker: /public/betai-sw-v300.js
- prawdziwy Web Push może działać przy zamkniętej karcie po skonfigurowaniu VAPID
- wysyłane są alerty użytkownika z V280 oraz alerty system/API dla adminów
- delivery audit + deduplikacja + automatyczne wyłączanie wygasłych subskrypcji

V285 HISTORICAL MATCH EXPLORER
- wyszukiwanie rozliczonych analiz
- filtr jakości
- model, wynik, decision i Brier
- kliknięcie meczu otwiera jego timeline

V286 PREDICTION TIMELINE VIEWER
- Freeze Ledger
- Odds Timeline
- lineup / pre-match events
- Decision History

V287 MODEL COMPARISON STUDIO
- porównanie wersji modelu na rozliczonej historii
- sample, Brier 1X2 i accuracy

V288 DATA COVERAGE DASHBOARD
- Official XI
- injuries
- weather
- referee
- travel
- closing line
- context
- quality >= 70

V289 SAFE BACKFILL ENGINE
- domyślnie OFF
- najpierw uzupełnia dane z już istniejącej historii bez requestów API
- opcjonalny API backfill wymaga jednocześnie:
  1) backfill_enabled=true w Admin Center
  2) BETAI_V300_API_BACKFILL_ENABLED=true w Netlify ENV
- dodatkowy API backfill ma twardy budżet 20 requestów/dzień i nie zmienia forecastu

V290 DATA RETENTION / CLEANUP
- czyści wyłącznie cache i starą telemetrię
- NIE usuwa match_prediction_snapshots
- NIE usuwa match_model_experiments
- NIE usuwa match_prediction_freeze_ledger

V291 ERROR RECOVERY
- retry queue dla wybranych match-specific jobów
- limit prób i backoff
- dead queue po przekroczeniu limitu

V292 ADMIN CONTROL CENTER
- SYSTEM SAFE MODE
- global AUTO JOBS / BACKFILL / ANALYTICS / WEB PUSH
- osobne przełączniki cron/jobów
- osobne przełączniki rynków
- osobne przełączniki lig widocznych w historii
- Feature Flags, A/B, retry, backfill, backup/restore i health snapshot

V293 FEATURE FLAGS
- enabled/disabled
- rollout 0–100%
- admin_only foundation

V294 A/B TESTING
- trwałe przypisanie wariantu do sesji
- startowy eksperyment prediction_explanation_layout jest domyślnie OFF
- control / compact 50:50

V295 USER ANALYTICS
- privacy-light product events
- nie zapisujemy surowego adresu IP
- analytics można wyłączyć jednym przełącznikiem

V296 RESPONSIBLE DECISION LAYER
- wysokie probability nigdy nie jest prezentowane jako gwarancja
- LOW SAMPLE i LOW RELIABILITY obniżają komunikat decyzji
- admin może wyłączyć ligę/rynek operacyjnie bez kasowania forecastu

V297 EXPORT CENTER
- CSV
- JSON
- prosty PDF historii analiz

V298 BACKUP / RESTORE
- kopiuje WYŁĄCZNIE konfigurację
- settings, flags, runtime controls, A/B, canary/model registry
- nie kopiuje haseł, Supabase Auth ani sekretów ENV

V299 SYSTEM HEALTH SCORE 0–100
- data coverage
- automation health
- API health
- anomalies / settlement / freeze integrity
- godzinowy snapshot
- WATCH / CRITICAL może utworzyć alert systemowy do Web Push admina

V300 MASTER OPERATIONS DASHBOARD
- jeden panel operacyjny w Symulacja AI
- health, coverage, jobs, API, model comparison, explorer, exports, admin
- SYSTEM SAFE MODE zatrzymuje match-specific automations i ustawia warstwę użytkownika read-only
- SAFE MODE nie wyłącza całej strony i nie dotyka niezwiązanych botów/Stripe/innych funkcji platformy

WDROŻENIE
----------
1. Supabase -> SQL Editor -> uruchom raz:
   SUPABASE_RUN_ONCE_WERSJA_300_PRODUCTION_PLATFORM_2_ALL_IN.sql

2. Wgraj cały ZIP V300 na Netlify.

3. Web Push — wymagane ENV w Netlify:
   VAPID_PUBLIC_KEY=
   VAPID_PRIVATE_KEY=
   VAPID_SUBJECT=mailto:admin@bet-ai.app

   Po instalacji zależności możesz wygenerować parę:
   node GENERATE_VAPID_KEYS_V300.js

   VAPID_PRIVATE_KEY jest sekretem. Nie umieszczaj go w VITE_* ani w frontendzie.

4. API Backfill jest celowo wyłączony po instalacji.
   Aby go dopuścić, ustaw w Netlify:
   BETAI_V300_API_BACKFILL_ENABLED=true
   i dopiero potem w Admin Center BACKFILL = ON.

HARMONOGRAM V300
----------------
- Web Push dispatcher: co 5 min
- Backfill: 04:17 UTC codziennie (domyślnie OFF)
- Cleanup: niedziela 04:47 UTC
- Retry worker: xx:11 i xx:41
- System Health Snapshot: xx:05

PAKIET NPM
----------
V300 dodaje zależność web-push 3.6.7.
Lokalne środowisko generowania nie dokończyło pobierania zależności z npm, dlatego pełnego `npm build` nie oznaczono jako zaliczonego.
Stary package-lock z V280 nie zawierał web-push, więc został usunięty z finalnej paczki zamiast zostawiać niespójny lockfile. Wersje w package.json są przypięte dokładnie; Netlify wykona czystą instalację npm.

BEZPIECZEŃSTWO DANYCH
---------------------
- wszystkie nowe tabele backendowe mają RLS
- Netlify Functions korzystają z SUPABASE_SERVICE_ROLE_KEY
- SAFE MODE nie usuwa danych
- cleanup nie usuwa immutable prediction history
- backup konfiguracji nie zawiera sekretów
- eksport jest tylko do odczytu

WAŻNE
-----
V300 jest warstwą produkcyjną/operacyjną. Nie zmienia matematycznego forecastu V200/V260/V280 tylko po to, żeby podnieść numer wersji. Jego zadaniem jest stabilność, obserwowalność, kontrola, historia, alerty i bezpieczne zarządzanie systemem.
