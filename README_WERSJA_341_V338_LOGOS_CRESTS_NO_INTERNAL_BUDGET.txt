BET+AI WERSJA 341 — V338 BASE ONLY

Zmiany wyłącznie na bazie V338:
1) Dashboard / kafle typów:
   - lekko powiększone herby klubów (desktop),
   - prawdziwe logo ligi jako fallback, gdy stary typ nie ma league_logo,
   - prawdziwa flaga kraju ligi obok opisu,
   - obsługa: Premier League, Championship, Bundesliga, Primeira Liga,
     Ekstraklasa, I Liga, La Liga, Segunda, Serie A, Serie B,
     Eredivisie, Ligue 1, Ligue 2, Champions League, Europa League,
     Conference League, MLS.
   - assety lig/flag są zwykłymi obrazami CDN i NIE zużywają requestów API-Football.

2) FM AI / API:
   - wyłączony WEWNĘTRZNY dzienny Budget Guard Symulatora AI,
   - nie pojawi się już blokada: "Dzienny budżet API Symulatora AI został osiągnięty...",
   - zachowane: cache, deduplikacja in-flight, kolejka/per-minute spacing,
     obsługa HTTP 429 oraz REALNY limit/quota dostawcy API-Football.

NIE ZMIENIONO:
- układu V338 poza rozmiarem herbów i brandingiem ligi,
- logiki typów,
- kursów,
- rozliczeń,
- Prediction Engine,
- Match Engine V320,
- Supabase schema.

SQL: NIEPOTRZEBNY.
