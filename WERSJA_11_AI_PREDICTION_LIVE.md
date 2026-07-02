# BetAI — wersja 11: AI Prediction Live

Dodano nową zakładkę **AI Prediction** pomiędzy **Typy AI** i **Top typerzy**.

## Co działa

- realne mecze piłkarskie z API-Sports / API-Football,
- okno najbliższych 12 godzin oraz mecze live,
- prawdziwe kursy rynku 1X2,
- usuwanie marży bukmachera i wyliczanie kursów fair,
- połączenie API-Football Prediction z konsensusem kursów,
- wybór AI, confidence, value bety i najlepszy dostępny kurs,
- filtrowanie Live / Value, sortowanie i automatyczne odświeżanie co 3 minuty,
- szczegóły meczu: forma, atak, obrona, Poisson, H2H i prognoza goli,
- eksport bieżących danych do CSV otwieranego w Excelu,
- pełny układ desktop i mobile.

## Wdrożenie

Nie jest potrzebny nowy SQL ani nowa tabela Supabase. Funkcja korzysta z tej samej zmiennej Netlify, której używają boty:

- `APISPORTS_KEY`, albo
- `API_SPORTS_KEY`, albo
- `API_FOOTBALL_KEY`.

Wdróż pełny projekt przez Git lub Netlify CLI, aby razem z frontendem została opublikowana funkcja:

`/.netlify/functions/get-ai-predictions`

Odpowiedź funkcji jest cache'owana przez CDN przez 3 minuty, żeby ograniczyć zużycie limitu API.
