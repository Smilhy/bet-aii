WERSJA 1884 — ALGORYTM: WSZYSTKIE MECZE, KURS NIE BLOKUJE TYPU

Zmiany:
- usunięto filtr wymagający kursu O/U 2.5 przed analizą;
- każdy nierozpoczęty mecz może zostać policzony;
- typ wybiera wyłącznie wyższe prawdopodobieństwo, minimum 51%;
- brak kursu zapisuje typ z kursem 0 i opisem „brak kursu”;
- kolejne skany co 15 minut próbują dopisać realny kurs;
- trafność jest rozliczana także bez kursu;
- zysk, ROI i Yield liczą się wyłącznie dla zakładów z realnym kursem > 1.00;
- nie jest potrzebny nowy SQL.

Wdrożenie: wgraj pełną paczkę lub podmień pliki z paczki TYLKO_ZMIENIONE, następnie Netlify: Clear cache and deploy site.
