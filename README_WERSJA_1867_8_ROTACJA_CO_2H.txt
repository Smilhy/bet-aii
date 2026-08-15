BetAI WERSJA 1867.8 — ROTACJA JEDEN BOT CO 2 GODZINY

Zmiana dotyczy wyłącznie automatów AI. Pozostała logika strony została zachowana.

Harmonogram (UTC, minuta 12):
- 00:12 — BetAI MultiSport AI
- 02:12 — Typer Expert
- 04:12 — Ograć Buka
- 06:12 — BetAI MultiSport AI
- 08:12 — Typer Expert
- 10:12 — Ograć Buka
- i tak dalej przez całą dobę.

Zasady:
- dokładnie jeden bot może zapisać typ w jednym cyklu,
- gdy bot z bieżącej kolejki nie ma kandydata lub jest w cooldownie, system próbuje następnego bota,
- wszystkie trzy boty mają cooldown 2 godziny,
- aktywny typ innego bota nie blokuje kolejnego slotu,
- antyduplikacja meczu i osobne strategie botów pozostają aktywne,
- ręczny przycisk „Odśwież dziś” uruchamia tylko BetAI MultiSport AI.

Wdrożenie: cały projekt przez Git lub Netlify CLI, aby Netlify zbudował Functions i harmonogram.
