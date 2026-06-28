BetAI WERSJA 1845 — TYPER EXPERT TYLKO API-FOOTBALL

Zmiany dotyczą wyłącznie konta Typer Expert.

Typer Expert korzysta teraz wyłącznie z API-Football:
- /fixtures — mecze i terminy,
- /odds — realne kursy kilku bukmacherów,
- /predictions — prognozy algorytmiczne, procenty 1X2, porównanie formy, ataku, obrony, Poissona, H2H i goli,
- /injuries — zgłoszone absencje dla analizowanych spotkań.

Usunięto całkowicie:
- OPENAI_API_KEY,
- OpenAI Web Search,
- ProBettingHub,
- Blogabet,
- Betfolio,
- SofaScore i Flashscore z logiki Typer Expert.

Silnik:
- skanuje o 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00 i 21:00 UTC,
- publikuje maksymalnie jeden nierozliczony typ,
- wymaga potwierdzenia rynku kursowego i prognozy API-Football,
- tworzy własne uzasadnienie do 500 znaków bez używania OpenAI,
- zachowuje dotychczasową progresję od stawki 1 do limitu 1000.

Wymagana zmienna Netlify:
APISPORTS_KEY lub API_SPORTS_KEY lub API_FOOTBALL_KEY

OPENAI_API_KEY nie jest potrzebny.

Test bez publikowania:
https://bet-ai.app/.netlify/functions/publish-typer-expert?dry_run=1

Wynik testu pokazuje m.in.:
- fixtures_found,
- odds_fixtures_found,
- market_candidates_found,
- api_candidates_checked,
- accepted_after_api,
- candidates[].api_football,
- errors.

Nie trzeba wykonywać SQL.
