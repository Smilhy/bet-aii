BETAI WERSJA 1867.6 — TRZY NIEZALEŻNE STRATEGIE BOTÓW

Poprawka wykonana na bazie 1867.5 bez zmian w logowaniu, Supabase, Stripe i interfejsie.

CO ZOSTAŁO POPRAWIONE
- BetAI MultiSport AI, Typer Expert i Ograć Buka nie używają jednego algorytmu wyboru.
- Wspólne jest tylko pobranie surowych meczów i kursów, aby oszczędzać limit API.
- Każdy bot ma własne filtry, scoring, rynki, progi, cooldown i analizę.
- Każdy bot sprawdza duplikaty wyłącznie we własnej historii.
- Ten sam mecz dla różnych botów jest dozwolony, gdy niezależne strategie wybiorą go osobno.
- Zakres kursów pozostaje 1.50–5.00.
- Skan kursów obejmuje domyślnie dwie strony API na każdy dzień.

STRATEGIE
1. BetAI MultiSport AI — szeroki silnik value; bez remisów, underów i BTTS NIE.
2. Typer Expert — własne połączenie stabilności rynku i prognozy API-Football.
3. Ograć Buka — selektywny API value, mały rozrzut rynku i stała stawka bez progresji.

DIAGNOSTYKA
/.netlify/functions/ai-bots-health?probe=1

Ręczny skan wszystkich strategii:
/.netlify/functions/publish-betai-multisport-ai?days=2&manual=1&dry_run=1

Osobne testy:
/.netlify/functions/publish-typer-expert?days=2&dry_run=1
/.netlify/functions/publish-ograc-buka?days=2&dry_run=1

Nie trzeba uruchamiać nowego SQL.
