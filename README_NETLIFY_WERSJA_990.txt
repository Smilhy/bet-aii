WERSJA 990 — CZYSTA PACZKA NETLIFY

To jest odchudzona paczka do deploya.
Zawiera tylko:
- src/
- public/ jeśli istnieje
- index.html
- package.json
- netlify.toml
- supabase/version_990_stat_cards_icons_ui_only.sql

Nie zawiera starych SQL-i i historii wersji, żeby Netlify łatwiej przyjął deploy.

Build:
npm run build

Publish:
dist

Logika bez zmian.
