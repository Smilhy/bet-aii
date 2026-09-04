BET+AI — WERSJA 137 — BACKTESTING & CALIBRATION ENGINE

1. Uruchom raz SQL:
   SUPABASE_RUN_ONCE_WERSJA_137_BACKTEST_CALIBRATION.sql

2. Nowa funkcja scheduled:
   netlify/functions/settle-match-prediction-snapshots.js
   - co godzinę sprawdza zakończone mecze
   - pobiera prawdziwy wynik z API-Football
   - zapisuje actual_home_goals / actual_away_goals
   - nie zmienia forecastu

3. Nowy endpoint:
   /.netlify/functions/get-match-prediction-performance
   - 1X2 accuracy
   - Brier Score
   - Over 1.5 / 2.5 / 3.5
   - BTTS
   - calibration buckets
   - Value ROI i profit units
   - wyniki per liga
   - wyniki per model_version

4. save-match-prediction został zabezpieczony:
   - po kickoffie istniejąca prognoza jest zamrożona
   - po kickoffie nie można stworzyć nowego snapshotu
   - przed kickoffiem można zapisać lepszy jakościowo snapshot

5. Ekran przygotowania meczu pokazuje globalny panel MODEL PERFORMANCE,
   gdy Supabase ma już rozliczone snapshoty.

UWAGA:
Mała próbka nie jest podstawą do wniosków o przewadze. Panel oznacza małą próbkę,
a kalibracja staje się użyteczna dopiero po większej liczbie rozliczonych meczów.
