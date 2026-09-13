BET+AI V377 — FM AI PRO MARKET EDGE SUITE
==========================================

CEL
===
V377 rozwija wyłącznie zakładkę FM AI na bazie V376. Przed zmianą został wykonany audyt
istniejących modułów, aby NIE dublować funkcji, które Bet+AI już posiada.

AUDYT — JUŻ BYŁO, WIĘC NIE DUBLUJEMY
=====================================
Bet+AI już ma m.in.:
- 10k / Monte Carlo i pełny silnik symulacyjny,
- TRUE/Fair Odds + no-vig,
- Market Consensus wielu bukmacherów,
- CLV + T24H/T6H/T1H/T15M odds timeline,
- Model Health, Brier, calibration, drift detector,
- Data Quality / Red Flag / NO BET gate,
- Champion vs Challenger / shadow testing / auto promotion / rollback,
- self-learning i league/market-specific calibration,
- pre-match re-score po składach i alerty market move,
- watchlist / browser alerts / operations control center,
- Performance Explorer,
- Auto Tracker 24/7,
- League stats + League×Market Segment Lab,
- Verified Record + Prediction Passport.

INSPIRACJE FUNKCJONALNE Z RYNKU
================================
Przejrzano aktualne funkcje platform takich jak Dimers, Unabated, Outlier, Action Network
oraz Betstamp. Nie kopiowano ich layoutu, kodu, brandingu ani tekstów.
Najbardziej użyteczne luki względem ich workflow dotyczyły:
- szybkiego filtrowania pełnej tablicy okazji,
- line shopping / best price,
- czytelnego market pressure i price dispersion,
- koncentracji otwartych typów,
- jeszcze prostszego Model vs Market.

NOWOŚCI V377
============
1. PRO OPPORTUNITY BOARD
- działa na już zeskanowanych meczach; zero nowych requestów API,
- filtry: decyzja, liga, rynek, minimalna reliability,
- sortowanie: Balance, EV, Edge, probability, Reliability, kickoff,
- szybki WHY AI i wejście do pełnej analizy.

2. MARKET PULSE + PRICE SHOP
- sortuje istniejące quote'y bukmacherów od najlepszego kursu,
- pokazuje BEST PRICE, medianę, rozjazd cen i przewagę ceny best vs median,
- MODEL vs MARKET na benchmarku no-vig,
- wykorzystuje istniejącą timeline T24H/T6H/T1H/T15M do MARKET PRESSURE:
  SUPPORTING / STABLE / AGAINST,
- pokazuje wiek sygnału (freshness),
- zero nowych requestów do dostawcy danych.

3. PORTFOLIO CONCENTRATION
- wykorzystuje tylko pending rekordy istniejącego System Trackera,
- pokazuje koncentrację po lidze i rynku,
- pokazuje największą liczbę typów w tym samym 30-minutowym oknie,
- LOW / MEDIUM / HIGH jest ostrzeżeniem o koncentracji, nie poradą stawkową.

4. MODEL vs MARKET W PREDICTION PASSPORT
- osobne dwie belki prawdopodobieństwa,
- pokazuje różnicę modelu względem benchmarku rynku,
- nie zmienia ani nie przelicza historycznego typu.

5. TIMEZONE SYNC DLA FM AI
- FM AI słucha istniejącego selektora strefy V371/V373,
- po zmianie strefy w topbarze także lista meczów FM AI i kickoff aktualizują się do tej strefy,
- cache dnia jest dalej scope'owany po dacie i strefie.

CZEGO CELOWO NIE DODANO
========================
- public bet percentages — brak wiarygodnego źródła danych w obecnym stacku,
- sync kont bukmacherskich — osobny obszar integracji i bezpieczeństwa, nie jest potrzebny do FM AI,
- SGP/parlay generator — wymaga osobnego correlation engine; nie dokładamy sztucznej korelacji,
- drugi CLV / drugi drift / drugi Champion-Challenger — te systemy już istnieją.

SUPABASE / API
==============
- BRAK nowego SQL.
- BRAK nowych tabel.
- BRAK nowych endpointów API-Football.
- V377 wykorzystuje dane już obecne w V347/V374/V375/V376.

BEZPIECZEŃSTWO ZMIANY
=====================
- Nie zmieniono matematyki forecastu.
- Nie zmieniono Value Policy V347.
- Nie zmieniono Auto Trackera V374.
- Nie zmieniono settlementu.
- Nie zmieniono Supabase.
- Zmiana jest addytywna w UI + synchronizacja istniejącej strefy czasu.
