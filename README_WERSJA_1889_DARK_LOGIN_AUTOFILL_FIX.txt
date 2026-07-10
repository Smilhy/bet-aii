WERSJA 1889 — CIEMNE POLA LOGOWANIA / AUTOFILL FIX

Naprawa dotyczy wyłącznie wyglądu ekranu logowania.
Opera/Chrome nakładały jasne tło na zapisane pola email i hasło przez mechanizm autofill.
Dodano mocniejsze, ciemne style dla autofill, hover, focus i active.

Nie zmieniono:
- logiki logowania,
- Supabase,
- Netlify Functions,
- zakładki Algorytm,
- automatycznych skanów i rozliczeń.

Wdrożenie:
1. Wgraj pełną paczkę lub podmień src/styles.css.
2. Netlify: Clear cache and deploy site.
3. Po wdrożeniu wykonaj twarde odświeżenie Ctrl+F5.

SQL nie jest potrzebny.
