Bet+AI WERSJA 324 — SIMULATOR STRICT 17 COMPETITIONS FIX

CEL:
Symulacja AI ma pobierać i pokazywać wyłącznie 17 wskazanych seniorskich rozgrywek.
V323 miał błąd dopasowania nazw przez includes(), przez co np. "U19 Bundesliga" przechodziła jako "Bundesliga".

V324 NAPRAWA:
1. Priorytet: dokładne ID API-Football rozgrywki.
2. Jeśli ID nie ma: dokładne dopasowanie znormalizowanej nazwy ligi, bez includes().
3. Dodatkowy hard-block: U16/U17/U18/U19/U20/U21/U22/U23, Under, Youth, Junior, Reserve, Women/Female/Frauen, Primavera.
4. Ten sam filtr działa backendowo i frontendowo.
5. Cache fallback również przechodzi przez ścisłą whitelistę, więc stare śmieci w cache nie pokażą się w Symulatorze.
6. Prediction Engine, xG, model, V320 i logika symulacji nie są zmieniane.

DOZWOLONE ROZGRYWKI:
39 Premier League
40 Championship
78 Bundesliga
94 Primeira Liga
106 Ekstraklasa
107 I Liga
140 La Liga
141 Segunda División
135 Serie A
136 Serie B
88 Eredivisie
61 Ligue 1
62 Ligue 2
2 UEFA Champions League
3 UEFA Europa League
848 UEFA Conference League
253 MLS / Major League Soccer

SQL: NIEPOTRZEBNY.
WDROZENIE: wgraj cały ZIP na Netlify.
