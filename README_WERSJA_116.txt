WERSJA 116 — pełny flow Symulator AI

Baza: WERSJA 115

Dodano:
1. Najbliższy mecz jest wyróżniony badge „NAJBLIŻSZY MECZ” i delikatnym cyan glow.
2. Każdy mecz ma licznik „Start za ...”, aktualizowany co sekundę.
3. Po wybiciu kickoffu mecz nadal automatycznie znika z listy (logika W115 zachowana).
4. Kliknięcie „Symuluj” otwiera nowy ekran „Przygotowanie meczu”.
5. Ekran przygotowania pobiera realne dane z get-match-simulator-data / API-Football:
   - kursy 1X2 z wybranego fixture,
   - forma,
   - H2H,
   - absencje,
   - oficjalne składy XI,
   - tabela,
   - statystyki drużyn,
   - prognoza/model API.
6. Pokazywana jest „Kompletność danych” w procentach.
7. Jeżeli oficjalne XI nie są jeszcze opublikowane, UI pokazuje „Oczekiwanie na oficjalne XI” — bez fikcyjnych nazwisk.
8. Po kliknięciu „Uruchom symulację” dane są przekazywane bez ponownego pobierania do istniejącego Match Engine.
9. Mecz startuje automatycznie po wejściu do silnika:
   - zegar 00:00 → 90:00,
   - pełny mecz ok. 2 min przy x1,
   - ruch zawodników,
   - piłka,
   - strzały, gole, kartki, rożne i zdarzenia,
   - wynik i statystyki aktualizowane w trakcie.
10. Dodany przycisk powrotu do listy meczów z ekranu przygotowania i Match Engine.

Nie zmieniono:
- hero,
- premium wyglądu listy z W114/W115,
- realOnly/API-Football,
- kolejności według kickoffu,
- automatycznego usuwania rozpoczętych meczów.
