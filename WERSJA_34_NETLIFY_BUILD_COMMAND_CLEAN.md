# WERSJA 34 — czysty build command Netlify

Usunięto niestandardowy build command z `netlify.toml`:

`chmod +x node_modules/@esbuild/linux-x64/bin/esbuild node_modules/.bin/esbuild node_modules/.bin/vite 2>/dev/null || true && npm run build`

Zostawiono zwykłe:

`npm run build`

Nie zmieniono frontu, mapy, botów, płatności, Supabase ani funkcji.
