BetAI WERSJA 63 — poprawka funkcji naprawy historycznych kursów

Błąd V62:
Funkcja próbowała pobierać nieistniejące kolumny:
- home_team_name
- away_team_name

Tabela algorithm_bets faktycznie ma:
- home_team
- away_team

V63:
- poprawia SELECT funkcji naprawczej,
- poprawia nazwy drużyn w raporcie,
- dodaje alias /repair-algorithm-recent-odds-v63,
- nie wymaga SQL,
- nie zmienia algorytmu ani wyników modelu.

Po wdrożeniu uruchom:
https://bet-ai.app/.netlify/functions/repair-algorithm-recent-odds-v63

Jeżeli chcesz przeliczyć wszystkie zakończone mecze z dostępnego okna archiwum:
https://bet-ai.app/.netlify/functions/repair-algorithm-recent-odds-v63?mode=all&limit=30
