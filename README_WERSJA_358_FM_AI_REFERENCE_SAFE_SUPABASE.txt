BET+AI WERSJA 358 — FM AI REFERENCE UI + SAFE SUPABASE

BAZA: WERSJA 353 przekazana przez użytkownika.

ZACHOWANE BEZ ZMIAN:
- oryginalny hero banner FM AI
- lewy panel wyszukiwania meczów / sport
- dolne pełne karty meczów i ich logika
- pełna analiza / Why AI / PRO / cache dnia
- pozostałe zakładki strony

ZMIENIONE:
- Top typ dnia: layout zgodny z zaakceptowanym reference screenem
- Najlepsze okazje dnia: nowe kompaktowe karty zgodne z reference screenem
- 1 fallbackowy mecz TESTOWY, wyłącznie gdy brak realnych wyników skanera
- SAFE Supabase optimization: in-flight dedupe + 1.25 s short cache dla identycznych GET/HEAD /rest/v1 requestów. Mutacje nie są cache'owane.

SQL: NIEPOTRZEBNY.
