BetAI WERSJA 50 — MOBILE STARTUP STABILITY

Poprawki wydajności i startu na telefonie, bez zmiany logiki typów, kursów i rozliczeń:
- Supabase getSession ma timeout 6.5 s; ekran „Ładowanie sesji...” nie może wisieć bez końca.
- Jeśli sesja jest zapisana w telefonie, aplikacja używa jej natychmiast i weryfikuje token w tle.
- Jednorazowe naprawy V48 i V49 nie odpalają się już przy każdym wejściu użytkownika.
- Feed typów pobiera się bezpośrednio po pojawieniu się sessionUser.
- Na telefonie hero ładuje tylko aktywny slajd zamiast aktywnego + dwóch sąsiednich dużych obrazów.
- Panele prawej kolumny poza ekranem korzystają z content-visibility:auto.

Nie wymaga SQL.
