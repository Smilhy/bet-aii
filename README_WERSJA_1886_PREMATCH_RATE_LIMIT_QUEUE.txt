BETAI — WERSJA 1886
ALGORYTM PRE-MATCH + KONTROLA LIMITU API + JEDEN WORKER

CO ZOSTAŁO NAPRAWIONE

1. Algorytm analizuje wyłącznie mecze przed rozpoczęciem.
   - obsługiwane statusy: NS i TBD,
   - analiza nie startuje później niż 10 minut przed kickoffem,
   - rozpoczęte i live mecze nie są pobierane do analizy,
   - mecz, którego nie udało się policzyć przed startem, zostaje oznaczony jako pominięty.

2. Tylko jeden worker może działać jednocześnie.
   - ręczny skan, automat i poprzedni cykl nie nakładają się,
   - Supabase przechowuje blokadę workera,
   - następny cykl jest pomijany, jeżeli poprzedni nadal działa.

3. Bezpieczne tempo API-Football.
   - zapytania są wykonywane sekwencyjnie,
   - domyślnie jedno zapytanie co 350 ms,
   - to około 2,8 zapytania na sekundę, poniżej limitu planu Pro 5/s,
   - po błędzie limitu minutowego system odczekuje 65 sekund i ponawia maksymalnie 2 razy.

4. Kolejka przetwarza najpierw mecze rozpoczynające się najwcześniej.
   - domyślnie do 20 spotkań w jednym cyklu,
   - maksymalny czas pracy około 11 minut,
   - postęp jest zapisywany po każdym meczu, więc nie przepada po zakończeniu funkcji.

5. Cache działa również dla pustych statystyk.
   - historyczny mecz bez danych nie jest odpytywany ponownie przy każdym skanie,
   - maksymalnie 8 historycznych spotkań jest sprawdzanych dla jednej drużyny,
   - po 2 pełnych próbach bez danych mecz dostaje status „Brak wystarczających statystyk”.

6. Typ nadal wybiera wyłącznie większe prawdopodobieństwo.
   - minimum 51%,
   - stawka 1 jednostka,
   - kurs nie zmienia kierunku typu,
   - brak kursu nie blokuje zapisania typu.

7. Rozliczanie pozostaje automatyczne.
   - nie odpytuje świeżo rozpoczętych meczów,
   - pierwsza próba rozliczenia następuje dopiero 125 minut po kickoffie,
   - gole z rzutów karnych nie są dodawane do rynku O/U 2.5.

WDROŻENIE

1. Supabase → SQL Editor.
2. Uruchom plik:
   supabase/WERSJA_1886_PREMATCH_RATE_LIMIT_WORKER.sql
3. Wgraj pełną paczkę do GitHub/Netlify.
4. Netlify → Deploys → Clear cache and deploy site.
5. Po wdrożeniu kliknij raz „Uruchom pełny skan”.
6. Kolejne cykle będą działały automatycznie co 15 minut.

WYMAGANE ZMIENNE NETLIFY

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APISPORTS_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

OPCJONALNE USTAWIENIA

ALGORITHM_API_MIN_INTERVAL_MS=350
ALGORITHM_API_RATE_LIMIT_RETRY_MS=65000
ALGORITHM_API_MAX_RATE_RETRIES=2
ALGORITHM_PREMATCH_MIN_LEAD_MINUTES=10
ALGORITHM_PROCESS_BATCH=20
ALGORITHM_MAX_HISTORY_STATS_CHECKS=8
ALGORITHM_MAX_MISSING_DATA_ATTEMPTS=2

WAŻNE

Nie uruchamiaj starego pliku package-lock.json. Paczka go nie zawiera.
Najpierw uruchom SQL V1886 — bez funkcji blokady worker zwróci czytelny błąd i nie rozpocznie skanu.
