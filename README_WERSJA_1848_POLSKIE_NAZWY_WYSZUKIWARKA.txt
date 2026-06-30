BETAI — WERSJA 1848 — POLSKIE NAZWY W WYSZUKIWARCE „DODAJ TYP”

ZMIANA:
- wyszukiwarka w zakładce „Dodaj typ” obsługuje teraz polskie nazwy reprezentacji/krajów,
- przykłady: Niemcy, Polska, Portugalia, Paragwaj, Hiszpania, Włochy, Francja,
- dalej działają nazwy angielskie, np. Germany, Poland, Portugal,
- obsługiwane są również wpisy bez polskich znaków,
- dodano dwie częste literówki z przykładu: „nimecy” i „protugalia”.

TECHNICZNIE:
- zmieniony tylko plik netlify/functions/get-sports-events.js,
- polska fraza jest tłumaczona wyłącznie na potrzeby wyszukania w API-FOOTBALL,
- oryginalna logika pobierania meczów, kursów, Netlify i Supabase nie została zmieniona,
- nie trzeba uruchamiać żadnego SQL w Supabase.

WDROŻENIE:
- wdrożyć pełny katalog projektu na Netlify tak jak poprzednią wersję,
- zachować dotychczasowe zmienne środowiskowe, w tym APISPORTS_KEY i dane Supabase.
