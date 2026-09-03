# BetAI v128 — Multi-Source Consensus Engine

Nowa warstwa researchu dla Symulatora AI.

## Źródła wyszukiwane
- ZuluBet — prognozy
- VitiSport — prognozy
- Flashscore — cross-check terminarza/formy/statystyk
- Sofascore — cross-check terminarza/formy/statystyk
- Meczyki.pl — newsy/analizy
- ProBettingHub — publiczne statystyki/typy typerów
- Blogabet — publiczne typy typerów
- OLBG — publiczne betting tips

Strumyk nie jest podłączany: to źródło streamingu, a nie wiarygodne źródło danych predykcyjnych.

## OpenAI Web Intelligence
Funkcja Netlify: `/.netlify/functions/get-match-consensus`

Aby włączyć live research dodaj w Netlify Environment Variables:
- `OPENAI_API_KEY`
- opcjonalnie `OPENAI_WEB_MODEL` (domyślnie `gpt-5.2`)

Klucz jest używany wyłącznie po stronie funkcji Netlify — nie trafia do frontendu.

Web Intelligence nie wymyśla brakujących źródeł. Jeśli serwis nie ma informacji o konkretnym meczu albo blokuje dostęp, wynik jest oznaczony jako brak/blocked.

## Model
Konsensus zewnętrzny jest dodatkowym sygnałem i nie zastępuje API-Football. Gdy jest dostępny, jest ważony według liczby znalezionych źródeł i confidence. Gdy go nie ma, Match Engine działa na danych API-Football i modelu Monte Carlo.

## Przewidywane XI
v128 poprawia fallback składu:
1. oficjalne XI,
2. historia realnych XI,
3. realne statystyki zawodników w sezonie i przewidywane ustawienie 4-3-3.

Przewidywany skład jest zawsze oznaczony jako prognoza, nigdy jako oficjalny.
