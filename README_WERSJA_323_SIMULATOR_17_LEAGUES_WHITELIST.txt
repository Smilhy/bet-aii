BET+AI WERSJA 323 — SYMULATOR: TYLKO 17 WYBRANYCH ROZGRYWEK

Zmiana dotyczy WYŁĄCZNIE wyboru meczów do Symulacji AI. Prediction Engine / V320 / logika prognoz bez zmian.

WHITELISTA:
1. England — Premier League
2. England — Championship
3. Germany — Bundesliga
4. Portugal — Primeira Liga
5. Poland — Ekstraklasa
6. Poland — I Liga
7. Spain — La Liga
8. Spain — Segunda División
9. Italy — Serie A
10. Italy — Serie B
11. Netherlands — Eredivisie
12. France — Ligue 1
13. France — Ligue 2
14. UEFA Champions League
15. UEFA Europa League
16. UEFA Conference League
17. USA/Canada — Major League Soccer (MLS)

Co zmieniono:
- topOnly=1 nie robi globalnego skanu wszystkich lig; API-Football /fixtures jest odpytywane tylko dla powyższych 17 competition IDs.
- frontend ma drugi twardy filtr tej samej whitelisty.
- daily fixture cache również korzysta z topOnly=1.
- usunięto Belgię, Szkocję i pozostałe niezamówione rozgrywki z Symulatora AI.
- lista może pokazać do 160 meczów z whitelisty; kosztowny Value Scanner nadal zachowuje osobny limit.

Nowego SQL nie trzeba uruchamiać.
