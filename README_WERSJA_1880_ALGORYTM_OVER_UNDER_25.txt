WERSJA 1880 — NOWA ZAKŁADKA „ALGORYTM”
========================================

CO ZOSTAŁO DODANE
-----------------
1. Nowa pozycja „📐 Algorytm” w lewym menu, bez zmiany logiki istniejącej zakładki Typy AI.
2. Automatyczny model Over/Under 2.5 oparty dokładnie na wzorze presji:
   - presja ofensywna = średnie strzały + średnie rożne,
   - presja defensywna = średnie strzały dopuszczone + średnie rożne dopuszczone,
   - oczekiwana presja gospodarzy = (ofensywa gospodarzy + defensywa gości) / 2,
   - oczekiwana presja gości = (ofensywa gości + defensywa gospodarzy) / 2,
   - łączna presja = suma oczekiwanej presji obu drużyn,
   - procent Over 2.5 jest interpolowany z tabeli z filmu,
   - procent Under 2.5 = 100% - procent Over 2.5.
3. Kursy Over/Under 2.5 są pobierane z API-Football.
4. System liczy EV dla obu stron i wybiera wyłącznie rynek z najwyższym dodatnim EV.
5. Jeżeli obie strony mają EV <= 0, mecz jest zapisany jako „BRAK ZAKŁADU”.
6. Każdy faktyczny zakład ma płaską stawkę 1 jednostka.
7. Automatyczne rozliczenie po 90 minutach, bez dogrywki i rzutów karnych.
8. Zakładka pokazuje Profit, ROI, skuteczność, liczbę zakładów, mecze oczekujące i pełne obliczenia.

PLIKI SUPABASE
--------------
Uruchom jeden raz w Supabase SQL Editor:

supabase/WERSJA_1880_ALGORITHM_OVER_UNDER_25.sql

Bez tego pliku zakładka nie będzie miała tabel do zapisu wyników.

NETLIFY ENVIRONMENT VARIABLES
-----------------------------
W Netlify -> Site configuration -> Environment variables muszą istnieć:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APISPORTS_KEY                 (lub API_SPORTS_KEY / API_FOOTBALL_KEY)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Opcjonalne:
ALGORITHM_FORM_MATCHES=5      liczba wcześniejszych meczów (3-10)
ALGORITHM_MAX_FIXTURES=12     maksymalna liczba nowych analiz na jeden skan
ALGORITHM_MIN_EDGE=0          0 = dowolne dodatnie EV, 0.03 = minimum +3% EV
ALGORITHM_ADMIN_EMAILS=smilhytv@gmail.com
APP_TIMEZONE=Europe/Warsaw

AUTOMATY NETLIFY
----------------
- scheduled-generate-algorithm-picks: skan co 3 godziny,
- scheduled-settle-algorithm-picks: rozliczanie co godzinę.

Administrator ma w zakładce dodatkowe przyciski „Uruchom skan” i „Rozlicz mecze”.
Zwykły użytkownik widzi tylko wyniki i przycisk odświeżenia danych.

WAŻNE
-----
Model z filmu jest naturalnie przechylony w stronę Under 2.5. Zakładka została zbudowana
właśnie po to, aby mierzyć jego realną skuteczność i wynik finansowy na nowych meczach,
a nie zakładać z góry, że działa.

TESTY
-----
npm run test:algorithm
npm run build

Oba polecenia zostały wykonane poprawnie przed spakowaniem tej wersji.
