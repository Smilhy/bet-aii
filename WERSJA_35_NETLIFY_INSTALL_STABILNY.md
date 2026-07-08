# WERSJA 35 — stabilizacja instalacji paczek Netlify

Zmiany:
- build command zostaje prosty: `npm run build`;
- build script używa `node ./node_modules/vite/bin/vite.js build`, więc nie wymaga chmod;
- dodano `.npmrc` z `audit=false`, `fund=false`, `progress=false`, `prefer-offline=true`;
- dodano `NPM_FLAGS` i `NPM_CONFIG_*` w `netlify.toml`, żeby instalacja paczek na Netlify była cichsza i mniej podatna na zawieszanie;
- poprawiono nazwę i wersję w `package.json` oraz `package-lock.json`.

Nie zmieniano frontu, mapy, botów, płatności, Supabase ani funkcji aplikacji.
