BET+AI WERSJA 355 — FM AI PRO SAFE OPTIMIZED + TEST MATCH

BAZA: stabilna V352.

FM AI:
- nowy wygląd PRO zgodny z zaakceptowanym mockupem: jasna hierarchia, TOP TYP, KPI, kondycja modelu, filtry, kompaktowe okazje
- zachowana logika V347/V352, cache dnia, WHY AI, pełna analiza i symulator
- zachowany oryginalny wygląd pełnych kart meczów poniżej sekcji TOP
- gdy nie ma już realnych meczów danego dnia, pojawia się dokładnie 1 MECZ TESTOWY OFFLINE
- mecz testowy jest wyraźnie oznaczony TEST i nie udaje prawdziwego typu
- kliknięcie Uruchom test otwiera istniejący offline lab/symulator

SAFE SUPABASE OPTIMIZATION:
- brak zmian w wyglądzie innych zakładek
- brak zmian w algorytmach/settlement/rankingu
- cache public profiles wydłużony z 60 s do 5 min
- public tips: 20 s cache + deduplikacja równoległych requestów
- referral dashboard: krótki cache wyniku 30 s
- celem jest mniej powtarzających się requestów, mniejsze obciążenie Supabase i egress

TESTY:
- TypeScript/JSX parser: MatchSimulatorDailyMatchesView.jsx OK, main.jsx OK
- TEST_WERSJA_347_FM_AI_MODEL_INTELLIGENCE: OK
- TEST_WERSJA_200_RELIABILITY_DATA_SCIENCE: OK
- TEST_WERSJA_355_FM_AI_PRO_SAFE: OK

UWAGA:
- pełny npm build nie był wykonywany w środowisku roboczym, bo paczka źródłowa nie zawiera node_modules i instalacja zależności nie była dostępna; składnia JSX została sprawdzona parserem TypeScript.
