WERSJA 30 — TYPER EXPERT HTTP ENDPOINT FIX

Naprawiony błąd HTTP 403 przy wejściu na:
/.netlify/functions/settle-typer-expert

Przyczyna:
- funkcja settle-typer-expert nadal miała schedule w netlify.toml,
- Netlify traktowało ją jako Scheduled Function,
- Scheduled Functions nie można wywoływać bezpośrednio przez URL w produkcji.

Zmiana:
- usunięto schedule z głównej funkcji settle-typer-expert,
- harmonogram przypięto do osobnego wrappera scheduled-settle-typer-expert,
- główny endpoint znów działa jako zwykła funkcja HTTP,
- automatyczne rozliczanie co godzinę nadal działa przez wrapper.

Nie zmieniano:
- logiki rozliczania,
- progresji,
- statystyk,
- dashboardu,
- CSS,
- Supabase schema.

Po wdrożeniu można uruchomić ręcznie:
https://bet-ai.app/.netlify/functions/settle-typer-expert?repair_days=45
