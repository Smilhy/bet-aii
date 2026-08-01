WERSJA 27 — NAPRAWA PUSTEJ ZAKŁADKI TYPY AI

Naprawiony problem:
- BetAI MultiSport AI nie był objęty watchdogiem minimum dziennego.
- Parser maintenance usuwał identyfikator "betai" i pilnował tylko Typer Expert oraz Ograć Buka.
- Gdy zwykły skan value nie znalazł kandydata, Typy AI mogły pozostać puste przez kilka dni.

Zmiany wyłącznie dotyczące Typów AI:
1. Watchdog Netlify obejmuje teraz: betai, typer, ograc.
2. Ręczny trigger force-daily-bot-tips obejmuje także BetAI.
3. Przycisk / automatyczny skan w zakładce Typy AI uruchamia tryb minimum dziennego,
   jeśli w bazie nie ma jeszcze typu na wybrany dzień.
4. Skan awaryjny sprawdza mecze do 7 dni naprzód i może użyć rezerwowej selekcji,
   gdy ścisły value scan nie znajdzie typu.

Nie zmieniono:
- progresji Typer Expert,
- statystyk,
- rankingu,
- dashboardu,
- banera,
- schematu Supabase ani SQL.

Testy:
- składnia wszystkich zmienionych funkcji Netlify: OK.
