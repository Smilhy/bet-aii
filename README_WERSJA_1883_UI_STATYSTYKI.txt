WERSJA 1883 — ZMIANA WYŁĄCZNIE WYGLĄDU ZAKŁADKI ALGORYTM

Zmiany:
1. Usunięto z widoku szeroki panel „Jak działa wybór typu”.
2. Logika algorytmu, próg 51%, stawka 1 j., skan co 15 minut i automatyczne rozliczanie pozostają bez zmian.
3. Dodano panel 9 statystyk wzorowany na sekcji Typy AI:
   - Yield
   - Zysk
   - Typy algorytmu
   - Wygrane
   - Przegrane
   - Oczekuje
   - Stawki algorytmu
   - Śr. kurs
   - Max kurs
4. Łączna stawka, średni kurs i maksymalny kurs są liczone automatycznie z zapisanych typów algorytmu.

SQL: NIE JEST POTRZEBNY.

Wdrożenie:
- wgraj pełną paczkę albo podmień src/AlgorithmView.jsx i src/styles.css,
- wykonaj Netlify: Clear cache and deploy site.
