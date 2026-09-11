BET+AI WERSJA 353 — FM AI MASTER CONSENSUS ENGINE

Cel:
Zlikwidować wrażenie, że karta przed symulacją i sama symulacja pokazują dwie różne predykcje.

Co zmieniono:
1. Daily Scanner na karcie meczu pokazuje teraz MASTER CONSENSUS 1X2, a nie kandydata VALUE jako główną prognozę.
2. VALUE CHECK jest osobną informacją. NO BET nie jest już przedstawiane jako główny typ meczu.
3. Po wejściu w pełną analizę Daily Scanner jest przekazywany do Prediction Engine.
4. MASTER CONSENSUS V353 łączy:
   - pełny model FM AI,
   - Daily Value Scanner,
   - rynek no-vig.
5. Wagi są adaptacyjne: pełny model pozostaje najważniejszy, Scanner dostaje wagę zależną od Data Quality / Agreement, a rynek od liczby i zgodności bukmacherów.
6. xG i rynki bramkowe również są scalane, a VALUE jest liczone dopiero na końcowej prognozie MASTER.
7. Jeżeli źródła mocno się rozjeżdżają, MASTER CONSENSUS GUARD blokuje VALUE; przy umiarkowanym rozjeździe STRONG VALUE jest obniżane do VALUE.
8. Match Simulator V320 dostaje predictionEngine z MASTER CONSENSUS, więc animacja korzysta z tej samej prognozy 1X2/xG co pełna analiza.
9. Grafika listy meczów, układ ligi, zespołów i przycisku Symuluj pozostają zachowane; zmieniono treść panelu predykcji/value.

Najważniejsze pliki:
- src/MatchSimulatorDailyMatchesView.jsx
- src/MatchSimulatorPreparationView.jsx
- src/styles.css

Nowy test:
- TEST_WERSJA_353_MASTER_CONSENSUS.cjs
