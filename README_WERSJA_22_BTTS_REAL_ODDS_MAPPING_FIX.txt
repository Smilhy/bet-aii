WERSJA 22 — POPRAWNE KURSY BTTS / OBIE DRUŻYNY STRZELĄ

Znaleziony błąd:
- importer API-FOOTBALL traktował każdy rynek zawierający „Both Teams Score” jako zwykły BTTS,
- przez to standardowe BTTS TAK/NIE mogło zostać połączone z rynkiem połowowym,
  kombinacją BTTS + gole albo innym wariantem TAK/NIE,
- mediana kursów była wtedy liczona z różnych rynków i wyświetlała błędną parę.

Poprawki:
1. Backend Netlify dopuszcza do BTTS wyłącznie czysty rynek pełnego meczu.
2. Odrzucane są BTTS 1. połowy, 2. połowy, obie połowy, kombinacje over/under,
   result/combo oraz rynki z linią liczbową.
3. Frontend ma drugi filtr ochronny, również dla starego lub obcego cache.
4. Zmieniono wersję schematu cache na btts-full-match-strict-v8,
   więc stare błędne kursy nie zostaną ponownie użyte.
5. W BTTS kolejność jest teraz: TAK, następnie NIE.
6. Bez nowego SQL i bez zmian schematu Supabase.

Po wdrożeniu Netlify świeże kursy zostaną pobrane ponownie z API.
