WERSJA 28 — TYPER EXPERT: BŁĘDNY ZWROT PST → PONOWNE ROZLICZENIE

Baza: Wersja 27 AI Picks Daily Watchdog Fix.

Naprawiony problem:
- status API-Football „PST” oznacza mecz przełożony, a nie anulowany,
- poprzednia wersja traktowała PST jak zwrot i zapisywała status VOID na stałe,
- po późniejszym rozegraniu meczu automat nie wracał już do błędnie rozliczonego rekordu.

Zmiany wyłącznie w:
- netlify/functions/settle-typer-expert.js

Nowe działanie:
1. PST pozostaje jako pending i jest sprawdzany przy kolejnych uruchomieniach.
2. Ostatnie błędne zwroty Typer Expert z powodem PST są automatycznie wyszukiwane i rozliczane ponownie.
3. Dodany bezpieczny fallback dla meczu Colorado Rapids — Austin FC, gdy stary schemat nie zapisał settlement_reason.
4. Po aktualnym wyniku 1:0 typ „Colorado Rapids wygra” zostanie zapisany jako WON.
5. Profit dla stawki 1.00 i kursu 1.78 zostanie wyliczony jako +0.78.

Nie zmieniono:
- interfejsu,
- dashboardu,
- progresji,
- Typów AI,
- rankingu,
- CSS,
- struktury Supabase.

SQL nie jest wymagany.
Po wdrożeniu funkcja settle-typer-expert uruchamia się automatycznie co godzinę (37. minuta).
Można ją też uruchomić ręcznie przez:
/.netlify/functions/settle-typer-expert
