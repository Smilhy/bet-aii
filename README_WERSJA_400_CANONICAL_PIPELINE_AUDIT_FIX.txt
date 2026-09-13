WERSJA 400 — CANONICAL PIPELINE AUDIT FIX

Drugi pełny audyt po V399 wykrył 2 edge-case'y, więc V399 nie był jeszcze uczciwie "100% spięty":

1) Jeśli pełna analiza nie miała zamrożonego rynku w top3, V399 mógł odziedziczyć część pól (np. no-vig/bookmaker/threshold) z INNEGO rynku i tylko nadpisać key.
   V400 wyszukuje dokładnie ten sam market w pełnej liście kandydatów. Gdy go nie ma, nie pożycza danych z innego rynku.

2) V399 mógł ponownie ustawić pierwotny STRONG_VALUE/VALUE po tym, jak późniejszy guard obniżył sygnał.
   V400 stosuje zasadę: MARKET IDENTITY JEST ZAMROŻONA, STATUS MOŻE TYLKO SPAŚĆ — NIGDY WZROSNĄĆ.

Dodatkowo V400 zamraża razem z top pickiem:
- market key
- probability
- bookmaker + odds
- fair odds
- no-vig probability
- margin
- edge / EV
- threshold
- calibration
- reliability
- market consensus
- league/market trust
- red flags / hard block

Pipeline:
FM AI board -> frozen complete snapshot -> preparation -> master consensus -> professional lab -> reliability guard -> saved forecast -> LIVE -> settlement/tracker.

Symulacja LIVE pozostaje probabilistyczna i NIE jest zmuszana do trafienia typu.

Test:
TEST_WERSJA_400_CANONICAL_PIPELINE_AUDIT.mjs
- 27 assertions PASS
- obejmuje brak cross-market contamination
- freeze ekonomii rynku
- downgrade-only decision policy
- settlement podstawowych rynków
- ten sam snapshot w prep/LIVE/engine

Ograniczenie audytu:
Pełnego produkcyjnego E2E Netlify + Supabase nie da się certyfikować offline bez sekretów ENV i działającego backendu. Kodowy pipeline został jednak sprawdzony i uszczelniony.
