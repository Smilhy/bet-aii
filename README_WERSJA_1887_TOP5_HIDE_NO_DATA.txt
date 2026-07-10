BET+AI — WERSJA 1887

ZMIANY:
1. Dodano panel TOP 5 NA DZIŚ: pięć gotowych typów pre-match o najwyższym prawdopodobieństwie modelu.
2. Ranking jest liczony wyłącznie po selected_probability; kurs nie zmienia kolejności ani kierunku typu.
3. Po pełnym sprawdzeniu historii brak kompletnych statystyk kończy analizę od razu.
4. Techniczne rekordy „Brak wystarczających statystyk” oraz mecze rozpoczęte przed analizą nie są pokazywane w dashboardzie ani w jego statystykach.
5. „Liczenie danych” pozostaje widoczne tylko dla meczu, którego worker jeszcze nie sprawdził albo aktualnie pobiera dane.

WDROŻENIE:
- Nowy SQL nie jest potrzebny.
- Wgraj pełną paczkę albo podmień pliki z paczki „TYLKO_ZMIENIONE”.
- Netlify: Clear cache and deploy site.
- Po wdrożeniu uruchom jeden pełny skan. Stare rekordy z błędem braku statystyk zostaną automatycznie zamknięte i znikną z widoku.
