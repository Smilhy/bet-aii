WERSJA 1882 — ALGORYTM: WYŻSZE PRAWDOPODOBIEŃSTWO + AUTOMAT 15 MIN + STATYSTYKI
================================================================================

NAJWAŻNIEJSZA POPRAWKA
----------------------
Wersja 1880 wybierała stronę z najwyższym EV. To powodowało błąd widoczny na przykładzie
Dundalk — Drogheda: Over miał tylko 44,8% szans, ale został wybrany przez wysoki kurs 3,75.

Od wersji 1882 kierunek wybiera WYŁĄCZNIE prawdopodobieństwo:
- jeżeli Under ma więcej procentów, typem jest Under,
- jeżeli Over ma więcej procentów, typem jest Over,
- większa szansa musi wynosić minimum 51%,
- stawka zawsze wynosi 1 jednostkę,
- kurs nie wybiera strony; służy wyłącznie do obliczenia zysku/straty.

PRZYKŁAD
--------
Over 44,8%, kurs 3,75
Under 55,2%, kurs 1,80

Typ wersji 1882: UNDER 2.5, ponieważ 55,2% > 44,8%.

PEŁNY AUTOMAT
-------------
1. Netlify uruchamia cykl co 15 minut.
2. Cykl najpierw próbuje rozliczyć zakończone mecze.
3. Następnie pobiera dzisiejsze mecze i kursy Over/Under 2.5.
4. Pobiera lub odczytuje z cache średnie strzałów i rożnych obu drużyn.
5. Oblicza presję oraz procent Over/Under.
6. Wybiera stronę z wyższym procentem przy progu minimum 51%.
7. Zapisuje lub aktualizuje rekord w Supabase.
8. Po zakończeniu meczu automatycznie liczy wynik i profit.

Skan jest uruchamiany przez Scheduled Function, która odpala Background Function.
Dzięki temu pełny skan może działać dłużej niż zwykła funkcja synchroniczna.

STATYSTYKI
----------
Zakładka „Statystyki” pokazuje:
- wykres bilansu kumulacyjnego,
- średni kurs,
- średnią szansę modelu,
- bilans wygranych/przegranych,
- maksymalne obsunięcie,
- wyniki według lig,
- wyniki według Over/Under,
- wyniki według zakresów kursów,
- wyniki według zakresów prawdopodobieństwa.

SUPABASE
--------
Jeżeli uruchomiłeś już SQL wersji 1880, uruchom teraz tylko:

supabase/WERSJA_1882_ALGORITHM_AUTOMAT_15MIN_STATS.sql

Plik dodaje tabelę historii automatycznych skanów „algorithm_runs” i aktualizuje opis modelu.

NETLIFY ENVIRONMENT VARIABLES
-----------------------------
Wymagane:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APISPORTS_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Opcjonalne ustawienia wersji 1882:
ALGORITHM_FORM_MATCHES=5
ALGORITHM_MIN_FORM_MATCHES=1
ALGORITHM_MAX_FIXTURES=250
ALGORITHM_MIN_PROBABILITY=51
ALGORITHM_ODDS_MAX_PAGES=50
ALGORITHM_CONCURRENCY=4
ALGORITHM_DAYS=1
ALGORITHM_INCLUDE_ALL=1
APP_TIMEZONE=Europe/Warsaw

UWAGA O LIMITACH API
--------------------
Pierwszy pełny skan może zużyć dużo zapytań API-Football, ponieważ dla każdej drużyny
musi pobrać wcześniejsze mecze oraz statystyki strzałów i rożnych. Kolejne skany korzystają
z cache Supabase. Liczba faktycznie przetworzonych meczów zależy od limitu Twojego planu
API-Football oraz od tego, czy API posiada kurs O/U 2.5 i komplet statystyk.

WDROŻENIE
---------
1. Uruchom SQL wersji 1882 w Supabase.
2. Wgraj pełną paczkę do repozytorium GitHub.
3. Nie dodawaj package-lock.json z innego środowiska.
4. W Netlify wybierz Clear cache and deploy site.
5. Po deployu wejdź w Functions i sprawdź, czy scheduled-generate-algorithm-picks ma status Scheduled.
6. W zakładce Algorytm możesz nacisnąć „Uruchom pełny skan”; skan wykona się w tle.

TESTY
-----
npm run test:algorithm
npm run build
