WERSJA 401 — END-TO-END SIGNAL LOCK

Drugi/ trzeci audyt wykazał, że samo V399/V400 nie wystarczało do uczciwego stwierdzenia „100% spięte”.
Pozostał jeszcze jeden ważny przypadek: AUTO TRACKER mógł wcześniej zamrozić pierwszy VALUE/STRONG VALUE, podczas gdy żywy scanner na tablicy później pokazywał już inny rynek.

V401 spina ten brakujący fragment:
AUTO TRACKER FREEZE -> TABLICA -> OTWÓRZ -> PREPARATION -> MASTER CONSENSUS -> PROFESSIONAL LAB -> LIVE -> SETTLEMENT.

Zasady V401:
1. Jeśli tracker ma już pierwszy opublikowany typ dla fixture, tablica używa tego zamrożonego rynku zamiast nowszego topFinal.
2. Przed kliknięciem „OTWÓRZ” system jeszcze raz odświeża tracker, żeby zamknąć race-condition między skanem a zapisem trackera.
3. Zamrożony market identity nie może się zmienić w preparation/LIVE.
4. Downstream może tylko OBNIŻYĆ status (STRONG -> VALUE -> SMALL EDGE/NO BET), nigdy podbić go ponad zamrożony sygnał.
5. LIVE pozostaje probabilistyczny — wynik symulacji nie jest wymuszany pod typ.
6. Tracker zapisuje dodatkowo w display_snapshot pełniejsze economics rynku bez zmiany schematu SQL:
   bookmaker, fair odds, no-vig, raw implied, margin, threshold, market group.
7. Stare rekordy trackera nadal działają; brakujące pola są odtwarzane/fallbackowane z obecnego kandydata, ale key/odds/probability/edge pozostają zamrożone.

Testy wykonane lokalnie:
- TEST_WERSJA_401_END_TO_END_SIGNAL_LOCK.mjs — 27 assertions PASS
- TEST_WERSJA_400_CANONICAL_PIPELINE_AUDIT.mjs — 27 assertions PASS
- TEST_WERSJA_390_IMMERSIVE_MATCH_EXPERIENCE.cjs — 17 guards PASS
- TEST_WERSJA_391_FEATURED_MATCH_INTELLIGENCE.cjs — 12 guards PASS
- TEST_WERSJA_353_MASTER_CONSENSUS.cjs — PASS
- TEST_WERSJA_320_REALISTIC_MATCH_ENGINE.mjs — PASS
- TEST_1763_SETTLEMENT_RYNKI_BOTA.js — 20 scenarios PASS

Ważne:
Nie da się uczciwie zagwarantować 100% produkcyjnego E2E bez wdrożenia i testu z prawdziwym Netlify + Supabase ENV. Lokalna paczka nie zawiera node_modules, więc pełny Vite build w tym środowisku nie został wykonany. Logika pipeline została natomiast ponownie prześledzona i uszczelniona.

SQL:
- brak nowego SQL; dodatkowe economics są trzymane w istniejącym JSONB display_snapshot.
