Bet+AI WERSJA 158 — MODEL VALIDATION & RISK LAB

NAJWAŻNIEJSZE:
1. NAPRAWA React error #31 przy uruchamianiu symulacji.
   Przyczyna: API potrafi zwracać obiekty np. coach={name:...} lub league={name:...},
   które React próbował renderować bezpośrednio. Match Engine normalizuje teraz pola tekstowe.

2. v153 Prediction Audit Trail
   - zapisuje hash i pełny snapshot wejść/wag/decyzji pre-match do Supabase,
   - bez nowych requestów API-Football.

3. v154 Error Analysis Engine
   - po rozliczeniu analizuje przegrane prognozy,
   - kategorie: niska jakość danych, konflikt źródeł, overconfidence, negatywny CLV,
     model drift, ensemble disagreement, normalna wariancja.

4. v155 Ensemble Models
   - Poisson/xG,
   - forma + home/away albo realna częstość rynku z ostatnich meczów,
   - API Prediction dla 1X2,
   - rynek no-vig,
   - Web Consensus, jeśli istnieje.

5. v156 Sharp Disagreement Detector
   - mierzy spread i odchylenie między niezależnymi modelami,
   - HIGH disagreement może wymusić NO BET,
   - MEDIUM podnosi uncertainty i może obniżyć BET -> WATCH.

6. v157 Portfolio Risk Simulator
   - volatility,
   - max drawdown,
   - stress windows 50/100/250,
   - udział dodatnich okien historycznych.

7. v158 Model Control Center
   - HEALTHY / WATCH / CRITICAL,
   - Brier, drift, Shadow ROI, CLV,
   - najlepsza/najsłabsza liga i rynek,
   - alarmy jakości modelu.

SQL DO URUCHOMIENIA RAZ:
SUPABASE_RUN_ONCE_WERSJA_158_MODEL_VALIDATION_RISK_LAB.sql
