BETAI — WERSJA 1844 — USUNIĘTY JASNY MOTYW

Zmiana dotyczy wyłącznie systemu wyglądu jasnego/ciemnego:
- całkowicie usunięto jasny motyw,
- usunięto ikonę słońca/księżyca z górnego paska,
- usunięto stan React odpowiedzialny za zmianę motywu,
- usunięto zapis i odczyt betai_theme z localStorage,
- usunięto atrybut data-betai-theme,
- usunięto reguły CSS jasnego motywu,
- strona działa wyłącznie w dotychczasowym ciemnym wyglądzie.

Nie zmieniono:
- typów i kont użytkowników,
- Typer Expert ani jego harmonogramu,
- Supabase i Netlify Functions,
- płatności,
- systemu 5 języków,
- układu strony i pozostałych funkcji.

WDROŻENIE:
1. Wgraj folder dist jako Production deploy na Netlify.
2. Wykonaj twarde odświeżenie Ctrl+Shift+R.
3. SQL nie jest potrzebny.
