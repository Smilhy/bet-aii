BET+AI — WERSJA 166 PREDICTION ENGINE 2.0 ALL-IN
================================================

TO JEST JEDEN PAKIET. NIE TRZEBA WGRYWAC V159, V160, V161... OSOBNO.
WERSJA 166 zawiera wszystkie moduły V159–V166 i zachowuje funkcje z V158.

CO DODANO
---------
V159 — PURE MODEL / MARKET SEPARATION
- rynek no-vig NIE jest już składnikiem Model Ensemble,
- rynek służy tylko do wyceny EDGE, fair price, CLV i kontroli ceny,
- Sharp Disagreement porównuje niezależne modele, a nie model z bukmacherem.

V160 — CHAMPION vs CHALLENGER
- Champion: BETAI_CHAMPION_V158_CORE,
- Challenger: BETAI_CHALLENGER_V166_DC_STRENGTH,
- oba warianty są zamrażane pre-match dla tego samego fixture,
- oba są rozliczane tym samym prawdziwym wynikiem,
- Challenger nie przejmuje systemu od razu,
- automatyczna promocja dopiero od 100 sparowanych, rozliczonych meczów,
- wymagane minimum +0.005 poprawy Brier Score i brak istotnej regresji rynku.

V161 — STATISTICAL CONFIDENCE ENGINE
- 95% confidence interval dla accuracy,
- 95% confidence interval dla Shadow ROI,
- PENDING / LOW / MEDIUM / HIGH,
- system pokazuje, czy wynik ma już sensowną próbę statystyczną.

V162 — MODEL AUTO-GATE
- ACTIVE / WATCH / BLOCKED osobno dla 1X2, O1.5, O2.5, O3.5 i BTTS,
- reaguje na Brier Score, Model Drift, Trust Score i sample size,
- BLOCKED automatycznie wymusza NO BET,
- WATCH może obniżyć BET do WATCH.

V163 — DIXON-COLES
- osobny model wyników piłkarskich,
- korekta niskich wyników 0:0, 1:0, 0:1, 1:1,
- pracuje równolegle z klasycznym Poissonem.

V164 — TEAM STRENGTH ENGINE
- opponent-adjusted Elo z rozliczonych meczów Bet+AI,
- home advantage,
- siła przeciwnika jest uwzględniana przez aktualizację Elo,
- gdy historia konkretnej drużyny jest za mała: bezpieczny fallback forma + tabela,
- brak nowych requestów API-Football.

V165 — CORRELATION & PORTFOLIO RISK
- wykrywanie korelacji TOP sygnałów (np. Over 2.5 + BTTS),
- LOW / MEDIUM / HIGH,
- exposure multiplier,
- historyczna koncentracja Shadow Portfolio wg rynku.

V166 — PROFESSIONAL MODEL DASHBOARD
- Active Model,
- Champion Brier / Challenger Brier,
- paired samples,
- Auto-Gate,
- Statistical Confidence,
- 95% CI Shadow ROI,
- Dixon-Coles rho,
- Team Strength HOME/AWAY,
- Model vs Market,
- Correlation Risk,
- Pure Model Ensemble,
- Model Control Center V166.

SUPABASE — TYLKO JEDEN NOWY SQL
--------------------------------
Uruchom RAZ:
SUPABASE_RUN_ONCE_WERSJA_166_PREDICTION_ENGINE_2_ALL_IN.sql

SQL tworzy tabelę:
public.match_model_experiments

Tabela zapisuje Champion i Challenger pre-match. Netlify settlement rozlicza potem oba
modele tym samym prawdziwym wynikiem. RLS jest włączone, brak publicznych policies jest
celowy — zapis/odczyt odbywa się przez SUPABASE_SERVICE_ROLE_KEY.

NETLIFY / API
-------------
- NIE dodano nowych requestów API-Football do przygotowania pojedynczego meczu.
- Dixon-Coles, Team Strength, Confidence, Auto-Gate i Correlation Risk liczą się z danych,
  które aplikacja już ma, oraz z istniejącej historii Supabase.
- Zmieniono:
  netlify/functions/save-match-prediction.js
  netlify/functions/settle-match-prediction-snapshots.js
  netlify/functions/get-match-prediction-performance.js

FRONTEND
--------
- src/predictionLabV166.js — nowe moduły V159–V166,
- src/MatchSimulatorPreparationView.jsx — integracja z Symulacją AI,
- src/styles.css — Professional Model Dashboard V166.

TEST
----
Uruchom:
npm run test:prediction-v166

Test sprawdza:
- Champion vs Challenger,
- Auto-Gate,
- opponent-adjusted Team Strength,
- Statistical Confidence + ROI 95% CI.

TRYB TESTOWY W SYMULACJI AI
---------------------------
Istniejący offline test 0 API został zachowany i rozszerzony na V166.
Nie zużywa requestów API-Football i pokazuje nowe moduły Prediction Engine 2.0.

WAŻNE
-----
Champion/Challenger nie powinien "udawać", że Challenger jest lepszy bez historii.
Na prawdziwej stronie początkowo zobaczysz COLLECTING / LEARNING. To jest poprawne.
Dopiero prawdziwe rozliczone mecze mogą promować Challenger.

Model jest narzędziem probabilistycznym. BET/WATCH/NO BET nie gwarantuje wyniku ani zysku.
