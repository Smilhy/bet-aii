BETAI — WERSJA 18

Naprawa pustego/czarnego ekranu po powrocie do uśpionej lub odrzuconej karty przeglądarki.

Zmiany wyłącznie stabilizacyjne:
- automatyczne jednorazowe odzyskanie aplikacji, gdy po wznowieniu #root jest pusty,
- odzyskanie po błędzie ładowania modułu/chunka JS,
- brak zwracania index.html dla brakujących plików /assets/*,
- brak cache dokumentu index.html i długi cache tylko dla plików z hashem Vite.

Nie zmieniono logiki użytkowników, typów, płatności, Supabase ani funkcji Netlify.
