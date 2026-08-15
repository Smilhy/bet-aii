BETAI V1885 — WSZYSTKIE MECZE + KOLEJKA + CACHE STATYSTYK

CO NAPRAWIONO
1. Każdy nierozpoczęty mecz z terminarza API jest od razu zapisywany w Supabase.
2. W zakładce Algorytm zobaczysz również mecze ze statusem „LICZENIE DANYCH”.
3. Automat co 15 minut przelicza kolejną paczkę spotkań.
4. Mistrzostwa świata i inne duże rozgrywki mają priorytet, więc np. Hiszpania–Belgia nie czeka za setkami małych lig.
5. Historyczne statystyki pojedynczego meczu są zapisywane w trwałym cache Supabase i nie są pobierane od nowa przy każdym skanie.
6. Pobieranie dziennych kursów zostało ograniczone, aby nie zużywało większości limitu API przed obliczeniem statystyk. Dla przeliczanego meczu kurs jest dodatkowo pobierany osobno.
7. Gdy API osiągnie limit, mecz nie znika. Pozostaje w kolejce i kolejny skan kontynuuje pracę.

WAŻNE
Dokładny wzór wymaga historycznych strzałów i rożnych. Każdy nowy zespół potrzebuje kilku zapytań do API-Sports. Przy niskim planie API wszystkie mecze nie zostaną policzone jednocześnie, ale od V1885 wszystkie będą widoczne i będą przeliczane kolejno.

WDROŻENIE
1. Uruchom w Supabase SQL Editor:
   supabase/WERSJA_1885_QUEUE_CACHE_ALL_FIXTURES.sql
2. Wgraj pełną paczkę do repozytorium.
3. Netlify: Clear cache and deploy site.
4. Po wdrożeniu kliknij „Uruchom pełny skan”.
5. Po kilku sekundach powinny pojawić się wszystkie przyszłe mecze jako gotowe typy albo „LICZENIE DANYCH”.

ZALECANE ZMIENNE NETLIFY
ALGORITHM_PROCESS_BATCH=10
ALGORITHM_CONCURRENCY=2
ALGORITHM_ODDS_MAX_PAGES=3
ALGORITHM_MAX_FIXTURES=1000
ALGORITHM_MIN_FORM_MATCHES=3

Nie dodano package-lock.json.
