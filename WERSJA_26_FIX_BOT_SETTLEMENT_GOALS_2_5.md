# WERSJA 26 — FIX: automatyczne rozliczanie typów Gole 2.5 botów

Problem: Typer Expert i Ograć Buka zapisywały typy goli z `market_key=goals_2_5`, ale funkcje rozliczające obsługiwały tylko `goals_over_under` i `goals_total`.

Efekt: typ `Powyżej/Poniżej 2.5 gola` po zakończonym meczu wracał jako `pending_admin_review` / zostawał `pending`, więc Typer Expert blokował dalszą progresję.

Naprawa:
- `settle-typer-expert.js` rozlicza `goals_2_5`,
- `settle-ograc-buka.js` rozlicza `goals_2_5`,
- `auto-settle-tips.js` rozlicza `goals_2_5` również dla typów użytkowników/publicznych,
- nie zmieniono frontu, Supabase, płatności ani logiki progresji.
