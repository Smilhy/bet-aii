BET+AI WERSJA 327 — SYMULATOR FULL DAY / 17 LEAGUES FIX

Problem:
- lista Symulacji AI potrafiła kończyć się np. na 15:00 mimo że później były mecze w zatwierdzonych ligach.

Przyczyny:
1) backend zwracał pierwszy niepusty cache dnia i nie sprawdzał brakujących lig,
2) frontend pokazywał wyłącznie mecze, które przeszły kosztowny pre-check jakości; Budget Guard mógł więc ukrywać późniejsze spotkania,
3) 17 zapytań do API-Football było wysyłanych równocześnie, co zwiększało ryzyko częściowych odpowiedzi / limitów.

Naprawa V327:
- topOnly=1 zawsze sprawdza wszystkie 17 zatwierdzonych rozgrywek,
- zwykły cache Supabase nie może już skrócić skanu Symulatora,
- zapytania 17 lig są wykonywane w kontrolowanych batchach po 4,
- Match Shield nadal cache'uje league+date i chroni budżet API,
- wszystkie prawdziwe mecze z whitelisty są widoczne od razu,
- pre-check jakości działa w tle i nie usuwa późniejszych meczów z listy,
- Value Scanner nadal używa tylko meczów zakwalifikowanych jakościowo,
- żadnych zmian w Prediction Engine, V320, xG ani modelach.

Whitelista nadal ma dokładnie 17 rozgrywek seniors:
Premier League, Championship, Bundesliga, Primeira Liga, Ekstraklasa, I Liga,
La Liga, Segunda División, Serie A, Serie B, Eredivisie, Ligue 1, Ligue 2,
UEFA Champions League, UEFA Europa League, UEFA Conference League, MLS.

SQL: NIEPOTRZEBNY.
