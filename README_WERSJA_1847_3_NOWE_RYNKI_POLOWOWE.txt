BETAI — WERSJA 1847
3 NOWE RYNKI PIŁKARSKIE Z REALNYMI KURSAMI API-FOOTBALL

DODANE RYNKI
1. Wynik do przerwy
   - gospodarz wygra do przerwy
   - remis do przerwy
   - gość wygra do przerwy

2. Drużyna wygra jedną z połów
   - gospodarz wygra co najmniej jedną połowę
   - gość wygra co najmniej jedną połowę

3. Gole w 1. połowie
   - Powyżej linii bramkowej w pierwszej połowie
   - Poniżej linii bramkowej w pierwszej połowie

DZIAŁANIE
- Strona nie tworzy sztucznych kursów.
- Nowe opcje pojawiają się tylko wtedy, gdy API-Football zwróci dany rynek i prawidłowy kurs większy od 1.00.
- Kurs jest zapisywany i publikowany tak samo jak przy dotychczasowych zakładach.
- Obsługiwane są kupony single oraz AKO.
- Pozostała logika strony i dotychczasowe rynki nie zostały zmienione.

AUTOMATYCZNE ROZLICZANIE
- Wynik do przerwy: score.halftime.
- Gole w 1. połowie: suma goli score.halftime.
- Drużyna wygra jedną z połów: porównanie wyniku 1. połowy oraz wyniku 2. połowy wyliczonego z score.fulltime - score.halftime.
- Jeżeli API nie zwróci wymaganych wyników okresów, typ trafia do pending_admin_review zamiast otrzymać błędne rozliczenie.

ZMIENIONE PLIKI
- src/main.jsx
- netlify/functions/get-sports-events.js
- netlify/functions/auto-settle-tips.js

WDROŻENIE
1. Rozpakuj ZIP.
2. Wdróż cały katalog projektu albo sam katalog dist zgodnie z dotychczasowym sposobem publikacji.
3. Funkcje Netlify muszą być wdrożone z katalogu netlify/functions.
4. Nie jest potrzebny nowy SQL ani zmiana tabel Supabase.
5. W Netlify musi pozostać ustawiony klucz API-Football używany już przez stronę.

TESTY
- npm run build: zakończony poprawnie.
- node --check get-sports-events.js: poprawnie.
- node --check auto-settle-tips.js: poprawnie.
- Testy rozliczeń nowych rynków: poprawnie dla HT 1X2, over/under 1H i wygrania dowolnej połowy.

UWAGA
Dostępność konkretnego rynku zależy od meczu, ligi, bukmachera oraz danych zwróconych przez API-Football. Brak danego rynku przy meczu oznacza, że API nie przekazało dla niego realnego kursu.
