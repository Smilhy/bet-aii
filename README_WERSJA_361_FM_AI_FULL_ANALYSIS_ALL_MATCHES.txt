BET+AI WERSJA 361 — FM AI FULL ANALYSIS ALL MATCHES

Zakres: tylko mechanizm analizy FM AI. Wygląd V360 pozostaje bez zmian.

Zmiany:
- każdy widoczny dzisiejszy mecz z obsługiwanych lig trafia do pełnego Value Scanner
- usunięty limit 24 analizowanych spotkań; limit skanera = pełna lista dnia (do 160)
- usunięty osobny quality pre-check, który wcześniej mógł odrzucać mecze przed skanem
- pełny skan pobiera formę obu drużyn, API Prediction, realne kursy i buduje value/consensus
- retry 429/5xx do 3 prób, skan sekwencyjny z odstępem, aby nie robić burstu
- gdy jest mniej danych formy niż standardowy próg, mecz NIE znika: dostaje wynik LIMITED_DATA z obniżoną wiarygodnością zamiast pominięcia
- gdy API chwilowo nie odpowie po retry, mecz pozostaje oznaczony jako przetworzony/fallback, a nie niewidoczny
- zwiększony dzienny budżet rate-shield dla Value Scanner, zachowane cache i Supabase snapshots

UWAGA: pełne sprawdzenie dużej liczby meczów trwa dłużej, ponieważ celowo wykonywane jest sekwencyjnie.
