# WERSJA 36 — Netlify install bez starego cache

Naprawa dotyczy deployu wiszącego na kroku `Installing npm packages`.

Zmiany:
- Node ustawiony na stabilne 20.x zamiast 22.23.1 z logów Netlify.
- Usunięty pin `packageManager`, żeby Corepack nie wymuszał npm 10.9.8.
- Wyłączone lifecycle scripts podczas `npm install`, bo lokalny build działa poprawnie bez nich.
- Wymuszony świeży npm cache: `/tmp/betai-npm-cache-v36`, żeby Netlify nie używał starego/uszkodzonego cache.
- `prefer-offline` wyłączone; instalacja ma brać paczki normalnie z registry.
- Build dalej zwykły: `npm run build`.

Nie zmieniono frontu, mapy, botów, płatności, Supabase ani funkcji aplikacji.

Po wrzuceniu tej wersji użyj w Netlify: `Clear cache and deploy site`.
