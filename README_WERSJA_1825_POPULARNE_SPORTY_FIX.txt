BetAI WERSJA 1825 — POPULARNE SPORTY FIX

Naprawiono błąd automatycznego tłumaczenia w widoku „Dodaj typ”.
MutationObserver wielokrotnie tłumaczył fragment „Popular” znajdujący się wewnątrz słowa „Popularne”, przez co napis rósł do postaci „POPULARNENENENE... SPORTY”.

Zmiany:
- tłumaczenie fragmentów działa tylko na całych słowach i całych frazach,
- podmiany identyczne z tekstem źródłowym są pomijane,
- dodano pełną frazę „Popularne sporty” dla PL / EN / DE / ES / RU,
- nie zmieniono logiki strony, układu ani funkcji dodawania typu.

Wdrożenie:
1. Wgraj nowy folder dist na Netlify.
2. Wykonaj twarde odświeżenie Ctrl+Shift+R.
3. Jeżeli stara karta była długo otwarta, zamknij ją i otwórz stronę ponownie.

SQL nie jest potrzebny.
