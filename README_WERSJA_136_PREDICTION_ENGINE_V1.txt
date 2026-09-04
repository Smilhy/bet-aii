Bet+AI WERSJA 136 — Prediction & Value Engine V1

Dodano:
- prognozy 1/X/2
- Over 1.5 / 2.5 / 3.5
- BTTS
- xG gospodarzy/gości
- fair odds
- top 3 najbardziej prawdopodobne wyniki
- Data Quality 0–100
- Multi-Source Consensus (jeśli Web Intelligence zwróci dane)
- Value Engine: VALUE DETECTED / NO BET / brak kursów
- zapis prognozy przed meczem do Supabase do późniejszego backtestingu
- Match Engine korzysta z forecast xG i 1X2 zamiast budować oddzielną prognozę

WAŻNE:
1. Uruchom raz plik SQL:
   SUPABASE_RUN_ONCE_WERSJA_136_MATCH_PREDICTION_SNAPSHOTS.sql
2. Na Netlify muszą być ustawione SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY.
3. OPENAI_API_KEY pozostaje opcjonalny dla Web Intelligence.

Prediction Engine jest probabilistyczny i nie gwarantuje wyniku ani zysku.
