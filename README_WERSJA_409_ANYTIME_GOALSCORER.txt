WERSJA 409 — ANYTIME GOALSCORER

ZMIENIONO TYLKO NOWY RYNEK W "DODAJ TYP":
- PL: Strzelec gola w dowolnym momencie
- EN: Anytime goalscorer
- rynek jest na samym dole listy rynków piłkarskich
- gdy API-FOOTBALL zwróci realne kursy, lista pokazuje zawodników i kursy
- gdy API nie zwróci kursów, sekcja nadal jest widoczna i pokazuje informację o braku realnych kursów
- typ można dodać jako singiel albo nogę AKO
- dodano market_key: anytime_goalscorer
- automatyczne rozliczenie po FT sprawdza zdarzenia bramkowe API-FOOTBALL; gole samobójcze nie zaliczają wybranego strzelca

ZMIENIONE PLIKI:
1. src/main.jsx
2. netlify/functions/get-sports-events.js
3. netlify/functions/auto-settle-tips.js

NIE ZMIENIANO:
- wyglądu pozostałych modułów
- Typów AI / V408
- FM AI
- innych rynków
- Supabase SQL

WDROŻENIE:
Opcja A: użyj całego folderu/projektu V409 i wykonaj normalny deploy Netlify.
Opcja B: podmień tylko trzy pliki wymienione wyżej w aktualnym V408, a następnie wykonaj deploy.

Nie jest wymagany żaden nowy SQL Supabase.
