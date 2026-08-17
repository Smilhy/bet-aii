BetAI WERSJA 68 — Typer Expert: naprawa polityki + limitu API

JSON z V67 ujawnił właściwą przyczynę:
- minOdds = 1.50, ale maxOdds = 1.20 -> zakres niemożliwy, więc 0 kandydatów,
- progression.maxStake = 1 -> progresja po przegranej była praktycznie wyłączona,
- progression.targetProfit = 0.01 zamiast 0.40,
- maxPickHoursAhead = 6 zamiast 24,
- minProbability / maxSpread również były nadpisane przez stare Netlify ENV,
- skan 7 dni robił kilkadziesiąt requestów naraz i wpadał w API minute-rate-limit.

V68:
1. Typer Expert używa kanonicznej polityki z kodu i ignoruje stare TYPER_EXPERT_* ENV.
2. Polityka:
   - kurs 1.50–5.00,
   - max 24h do startu,
   - cooldown 2h,
   - progresja base 1 / max 1000 / cel +0.40,
   - po przegranej następna stawka liczy odzyskanie strat + 0.40.
3. Jawne parametry URL typer_* nadal mogą służyć do ręcznych testów.
4. Gdy uruchamiany jest tylko Typer Expert, skanuje dziś + jutro zamiast 7 dni,
   co mocno ogranicza burst requestów i błędy 'Too many requests'.
5. Nie ruszono innych botów, Algorytmu, Dashboardu ani UI.

Po wdrożeniu:
https://bet-ai.app/.netlify/functions/repair-typer-expert-v68

Kontrola:
https://bet-ai.app/.netlify/functions/check-typer-expert-v68

SQL nie jest potrzebny.
