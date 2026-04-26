# Bet+AI — wersja 11

Krok 11: Supabase — formularz “Dodaj typ” zapisuje dane do tabeli `tips`.

## Jak uruchomić lokalnie

```bash
npm install
npm run dev
```

## Jak podłączyć Supabase

1. Wejdź do Supabase i utwórz projekt.
2. Otwórz `supabase/schema.sql`.
3. Skopiuj całość do Supabase → SQL Editor → Run.
4. Skopiuj `.env.example` jako `.env`.
5. Wklej swoje dane:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Uruchom ponownie projekt.

## Co działa

- formularz dodawania typu,
- wybór Free/Premium,
- cena premium,
- AI probability slider,
- tagi,
- zapis do Supabase.

## Następny krok

Wersja 12: pobieranie typów z Supabase i wyświetlanie ich w feedzie dashboardu.
