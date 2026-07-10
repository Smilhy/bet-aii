WERSJA 1892 — PRZYWRÓCONY MINIMALNY KURS 2.00

Zasady algorytmu:
1. Analiza wyłącznie pre-match.
2. Kierunek wybiera wyższe prawdopodobieństwo Over/Under 2.5.
3. Minimalne prawdopodobieństwo: 51%.
4. Minimalny kurs wybranego rynku: 2.00.
5. Stawka: 1 jednostka.
6. Kurs nie zmienia kierunku typu — decyduje tylko, czy zakład zostanie zapisany.
7. Brak kursu albo kurs 1.99 i niższy = brak zakładu.
8. Kurs dokładnie 2.00 spełnia warunek.
9. Rekord bez zakładu może zostać automatycznie zmieniony w zakład podczas kolejnego skanu, jeśli przed startem pojawi się kurs minimum 2.00.
10. Kurs zapisanej stawki jest blokowany w chwili spełnienia warunku.

SQL NIE JEST POTRZEBNY.

Wdrożenie:
- wgraj pełną paczkę albo pliki z małej paczki,
- Netlify: Clear cache and deploy site,
- nie używaj starszego package-lock.json,
- po wdrożeniu uruchom jeden pełny skan.
