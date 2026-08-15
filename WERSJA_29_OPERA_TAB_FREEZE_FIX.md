# WERSJA 29 — Opera / powrót z karty bez freeze

Naprawa problemu, w którym po przejściu na inną kartę i powrocie do BetAI Opera potrafiła zawiesić UI albo pokazać czarny ekran.

Zmiany:
- usunięto twarde auto-przeładowanie po zwykłym powrocie z karty;
- reload zostaje tylko dla prawdziwie odrzuconej karty `document.wasDiscarded`;
- dodano centralny guard V29 dla powrotu z karty;
- ciężkie odświeżenia po `focus`, `visibilitychange` i `pageshow` są opóźnione i deduplikowane;
- watchdog botów nie odpala już przy każdym powrocie na kartę admina;
- fetch typów nie startuje wielokrotnie równolegle;
- TOKEN_REFRESHED Supabase nie wykonuje pełnego initial load;
- w Operze automatycznie włącza się tryb stabilności renderera: pauza animacji podczas ukrycia/wznowienia i wyłączenie `backdrop-filter`, który często zawiesza renderer przy `zoom`/dużym layoucie.

Bez zmian:
- Supabase schema;
- płatności;
- boty i progresja;
- logika typów;
- Netlify Functions poza brakiem nowych zmian.

Build Vite: OK.
