WERSJA 185 FINAL

Co zrobić:
1. W Supabase otwórz SQL Editor.
2. Wklej cały plik SQL_BETAI_TIP_RPC_V185.sql jako nowe zapytanie i kliknij Run.
3. Na Netlify podmień index.html z tej paczki.
4. Zrób twarde odświeżenie strony.
5. Wyloguj się i zaloguj ponownie.
6. Przetestuj wysłanie 1 żetonu.

Ta wersja:
- ustala nadawcę z prawdziwej sesji Supabase
- wysyła napiwek tylko przez RPC w Supabase
- odejmuje nadawcy i dodaje odbiorcy w jednej operacji
- zapisuje transakcję, powiadomienie i wiadomość
- odświeża saldo w UI po sukcesie
