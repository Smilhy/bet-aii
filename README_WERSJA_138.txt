BET+AI — WERSJA 138
VALUE BET ENGINE V2 + RATE LIMIT SHIELD

NAJWAŻNIEJSZE ZMIANY

1. RATE LIMIT SHIELD API-FOOTBALL
- wspólny cache API-Football w Supabase,
- pamięć podręczna także w ciepłej funkcji Netlify,
- deduplikacja identycznych requestów,
- globalny limiter requestów przez atomowy slot w Supabase,
- domyślne tempo ok. 218 requestów/min przy limicie 300/min,
- automatyczny retry przy 429 / Too many requests,
- możliwość użycia ostatniego poprawnego cache przy chwilowym 429,
- ekran przygotowania nie pokazuje surowego błędu rateLimit,
- skan dziennych meczów działa maksymalnie po 2 równolegle,
- po wybraniu meczu skan dnia jest anulowany, aby nie konkurował o limit API,
- brak oficjalnego/przewidywanego XI nadal NIE blokuje symulacji,
- usunięto kosztowny łańcuch dodatkowych requestów tylko po to, aby zgadywać XI.

2. VALUE BET ENGINE V2
- model Bet+AI vs realne kursy bukmachera,
- implied probability,
- usuwanie marży bukmachera (no-vig),
- Fair Odds,
- Edge w punktach procentowych,
- Expected Value (EV),
- osobne progi minimalnego edge dla 1X2, goli i BTTS,
- próg korygowany jakością danych i kalibracją historyczną,
- klasyfikacja: STRONG VALUE / VALUE / SMALL EDGE / NO BET,
- TOP 3 rynki meczu,
- brak rekomendacji przy zbyt małej próbce backtestowej lub słabej kalibracji,
- preferowana kalibracja danej ligi przy min. 30 próbach, w innym razie globalna,
- kursy z tego samego bukmachera są używane do poprawnego no-vig.

3. BACKTEST / CALIBRATION
- korzysta z silnika v137,
- prognoza jest zamrożona przed kickoffem,
- Value V2 zapisuje model_version BETAI_FORECAST_V2,
- rozliczanie obsługuje również under oraz BTTS NO,
- performance zwraca kalibrację osobno dla rynków.

WAŻNE — SUPABASE
Przed pełnym uruchomieniem v138 uruchom RAZ:
SUPABASE_RUN_ONCE_WERSJA_138_RATE_LIMIT_SHIELD.sql

SQL tworzy:
- match_simulator_api_cache,
- match_simulator_api_rate_state,
- betai_reserve_match_api_slot(...).

Nie usuwaj tabel z v131/v136/v137 — v138 korzysta z ich snapshotów i historii.

UWAGA O REKOMENDACJACH
Przy świeżym backteście Value V2 może celowo pokazywać:
NO BET — KALIBRACJA / ZA MAŁA PRÓBKA.
To jest zabezpieczenie, a nie błąd. Rekomendacja VALUE pojawi się dopiero po osiągnięciu wymaganego minimum rozliczonych prób dla rynku.
