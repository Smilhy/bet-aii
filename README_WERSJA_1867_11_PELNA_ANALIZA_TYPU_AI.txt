BetAI — WERSJA 1867.11
PEŁNA ANALIZA TYPU AI / DEEP MATCH INTELLIGENCE

Baza: WERSJA 1867.9 (nie użyto odrzuconej wersji 1867.10).

Zmiany dotyczą wyłącznie zakładki Typy AI i przycisku „Zobacz analizę”:
- pełnoekranowy premium modal analizy,
- dokładne uzasadnienie wyboru typu,
- porównanie prawdopodobieństwa modelu i rynku,
- fair kurs, przewaga w punktach procentowych i EV,
- porównanie drużyn,
- prognoza API-Football,
- ostatnie H2H i podsumowanie bramek,
- tabela i forma ligowa,
- absencje oraz dane meczu,
- ciekawostki, ryzyka i lista kontrolna przed meczem.

Nowa funkcja Netlify:
netlify/functions/get-ai-deep-analysis.js

Funkcja pobiera rozszerzone dane dopiero po kliknięciu „Zobacz analizę”, zapisuje wynik w cache przeglądarki na czas sesji i działa częściowo również wtedy, gdy zewnętrzne API nie zwróci wszystkich danych.

Nie zmieniono:
- strategii botów,
- cooldownów,
- publikowania i rozliczania typów,
- tabel Supabase,
- logiki płatności i kont.

Nie jest wymagany nowy SQL.
