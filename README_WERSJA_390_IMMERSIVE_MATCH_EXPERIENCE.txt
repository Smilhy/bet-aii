WERSJA 390 — FM AI IMMERSIVE MATCH EXPERIENCE

Najważniejsze zmiany:
1. Duży przycisk „Uruchom symulację” bezpośrednio przy godzinie meczu w ekranie przygotowania.
2. PRE-MATCH → LIVE continuity strip: 1X2, xG, faworyt, główny sygnał FM AI i profil atmosfery.
3. LIVE ALERT CENTER: momentum, set piece risk, high danger, late goal window i reakcja po golu/czerwonej kartce.
4. GOAL WINDOW 10': dynamiczny wskaźnik zagrożenia liczony wyłącznie z dotychczasowego przebiegu symulacji.
5. Interaktywny timeline meczu z markerami i szybkim replayem po kliknięciu zdarzenia.
6. Widoki boiska: WIDOK MECZU / ANALIZA / STREFY BOISKOWE / SIATKA PODAŃ.
7. Strefy aktywności i pass trails są rysowane z realnego przebiegu silnika V320, a nie z losowych dekoracji.
8. Sterowanie tempem x1 / x2 / x5 / x10 oraz skróty HT / 70' / FT.
9. Trzy tryby komentarza: COMPACT / RICH LIVE / AI INSIGHT.
10. Atmosfera stadionu: CALM / NORMAL / INTENSE, realne nagranie stadionowe z istniejącego systemu audio oraz profil kibicowski drużyn.
11. Supporter identity / przydomki dla rozpoznanych klubów + bezpieczny fallback dla wszystkich pozostałych drużyn.
12. Gdy brak XI, ekran nie jest pusty: pokazuje profil stylu drużyny zamiast wymyślonych zawodników.
13. Efekty wizualne dla wysokiego zagrożenia, strzału, gola i czerwonej kartki.
14. Pełny AI MATCH STORY po 90': kluczowy moment, kontrola meczu, expected vs simulated, zgodność scenariusza i MVP.
15. Replay kluczowego momentu oraz nowy scenariusz z tego samego profilu Bet+AI.

Ważne:
- Nie zmieniono schematu Supabase.
- Nie zmieniono zasad Prediction Engine ani głównej prognozy.
- Symulacja nadal jest reprezentatywnym scenariuszem z zamrożonego profilu Bet+AI.
- Nie dodano fikcyjnych składów ani fikcyjnych danych API.
- Profil kibicowski jest informacyjny. Audio stadionowe pozostaje ogólną atmosferą stadionu, nie podszywa się pod licencjonowane nagrania konkretnego klubu.

Zmodyfikowane pliki:
- src/MatchSimulatorPreparationView.jsx
- src/MatchSimulatorView.jsx
- src/RealisticMatchCanvasV320.jsx
- src/styles.css
- package.json

Test:
node TEST_WERSJA_390_IMMERSIVE_MATCH_EXPERIENCE.cjs
