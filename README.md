# BetAI — wersja 199 CLEAN ULTRA PRO

Wersja 199 bazuje na paczce `wersja_198_ranking_ultra_pro_ozywienie_FULL` i została oczyszczona z niepotrzebnych plików archiwalnych oraz duplikatów.

## Co zostało zachowane
- pełny kod aplikacji React/Vite,
- loader i logowanie bez zmian,
- dashboard, ranking, premium, wallet, admin finanse i admin wypłaty,
- Netlify Functions,
- wszystkie pliki SQL Supabase potrzebne jako historia/migracje projektu,
- aktualny banner używany w CSS: `public/ranking-gold-banner-selected.png`.

## Co usunięto
- stare archiwalne pliki `README_v139`–`README_v198`,
- krótkie tymczasowe notatki `.txt` po wcześniejszych poprawkach,
- nieużywany duplikat grafiki `public/ranking-green-banner-final.png` — miał identyczną zawartość jak aktywny banner i nie był nigdzie importowany.

## Uruchomienie lokalne
```bash
npm install
npm run dev
```

## Build / Netlify
```bash
npm run build
```

Netlify:
- Build command: `npm run build`
- Publish directory: `dist`

## Zmienne środowiskowe
Użyj `.env.example` jako wzoru i ustaw realne klucze w Netlify/Supabase/Stripe.
