BET+AI WERSJA 152 — PROFESSIONAL PREDICTION LAB ALL-IN

Wersje połączone:
V147 Walk-Forward Backtesting
V148 Uncertainty Engine / Conservative Probability
V149 Model Drift Detector 30/50/100
V150 League & Market Trust Score
V151 Paper Betting / Shadow Portfolio 1u
V152 Professional Bet Decision Card

DODATKOWO: 1 scenariusz testowy OFFLINE / 0 API requestów.
Na liście Symulatora AI jest przycisk „URUCHOM TEST V152”. Test nie zapisuje się do Supabase,
nie jest liczony do realnego backtestu i nie udaje prawdziwego meczu. Służy tylko do sprawdzenia UI,
Prediction Lab oraz pełnej symulacji 2D przy wyczerpanym limicie API-Football.

SUPABASE:
Uruchom raz: SUPABASE_RUN_ONCE_WERSJA_152_PROFESSIONAL_PREDICTION_LAB.sql

WAŻNE:
- Walk-Forward używa wyłącznie wcześniejszych, już rozliczonych prognoz jako historii dla następnej obserwacji.
- Uncertainty obniża prawdopodobieństwo używane do finalnej decyzji.
- Drift analizuje ostatnie 30/50/100 prognoz.
- Trust Score jest liczony per liga i rynek.
- Shadow Portfolio zapisuje tylko finalne decyzje BET i rozlicza je po prawdziwym wyniku.
- Decision Card ma trzy stany: BET / WATCH / NO BET.
- System nie gwarantuje zysku ani wyniku zakładu.
