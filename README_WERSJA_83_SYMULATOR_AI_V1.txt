WERSJA 83 — BET+AI SYMULATOR AI / MATCH ENGINE V1

NOWA ZAKŁADKA:
- dodana po „Algorytm”: ⚽ Symulator AI
- reszta menu i dashboardu bez zmian

PIERWSZY TEST:
- domyślne wyszukiwanie: Udinese Venezia
- nie ma hardcodowanego wyniku ani fake statystyk
- wyszukiwarka pobiera realny fixture przez istniejący get-sports-events

NOWY ENDPOINT:
- netlify/functions/get-match-simulator-data.js
- pobiera z API-Football / API-Sports:
  * dane fixture
  * predictions pre-match
  * H2H (do 8 meczów)
  * injuries / absencje
  * standings / tabela (jeśli rozgrywki mają tabelę)
  * ostatnie 8 meczów obu drużyn
  * team statistics dla sezonu/ligi (jeśli dostępne)
  * fixtures/lineups — PRAWDZIWA oficjalna XI, gdy API ją opublikuje

WAŻNE O SKŁADACH:
- Bet+AI nie wymyśla nazwisk.
- jeśli oficjalne składy nie są jeszcze opublikowane, UI pokazuje „Oczekiwanie na oficjalny skład”.
- po publikacji przez API prawdziwe nazwiska i ustawienie pojawiają się w module.

SILNIK SYMULACJI V1:
- realna prognoza API ma największą wagę
- forma ostatnich meczów
- atak / obrona
- średnie bramek zdobytych i traconych
- H2H
- absencje
- przewaga gospodarza
- 6000 symulacji Poissona / Monte Carlo
- wynik na ekranie = najczęstszy scenariusz modelu, nie przypadkowy wynik

ANIMACJA:
- boisko 2D
- 11 kółek na drużynę
- ruch zawodników i piłki
- zegar 0–90
- gole, strzały, rożne, kartki
- aktualny wynik i timeline
- prędkość x1/x2/x4/x8
- jeśli prawdziwe lineups są dostępne: numery i nazwiska zawodników na boisku

PLIKI ZMIENIONE/DODANE:
- src/main.jsx
- src/MatchSimulatorView.jsx (NOWY)
- src/styles.css
- netlify/functions/get-match-simulator-data.js (NOWY)

TESTY:
- składnia JSX src/main.jsx: OK
- składnia JSX src/MatchSimulatorView.jsx: OK
- składnia Node get-match-simulator-data.js: OK
- pełny npm build nie został uruchomiony w środowisku roboczym z powodu braku dostępu do pobrania pakietów npm; kod JSX został sprawdzony parserem TypeScript.
