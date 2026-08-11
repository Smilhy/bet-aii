BetAI WERSJA 62 — naprawa prawdziwych historycznych kursów Over/Under 2.5

Problem:
W zakładce Algorytm -> Wyniki stare rekordy mogły mieć błędny snapshot rynku,
np. Over 2.5 = 4.00 przy normalnym rynku około 1.5-1.8.

Co robi V62:
1. Dla zakończonych meczów z ostatnich maksymalnie 7 dni pobiera ponownie
   archiwalne kursy pre-match z API-Football /odds.
2. Wykrywa podejrzane pary Over/Under m.in. po nierealnej sumie implied probability.
3. Używa filtra outlierów z V60 i zapisuje realny rynek Over 2.5 / Under 2.5.
4. Zachowuje nazwę bukmachera oraz liczbę źródeł.
5. NIE nadpisuje selected_odds — ten kurs jest zamrożonym kursem faktycznie
   użytym przez algorytm przy zapisaniu zakładu.
6. W wynikach kursy naprawione z archiwum mają etykietę KURS ARCH.

Po wdrożeniu uruchom raz:
https://bet-ai.app/.netlify/functions/repair-algorithm-recent-odds-v62

Domyślnie naprawiane są tylko podejrzane rekordy.
Aby sprawdzić wszystkie zakończone rekordy z ostatnich 6 dni:
https://bet-ai.app/.netlify/functions/repair-algorithm-recent-odds-v62?mode=all&limit=30

WAŻNE:
Oficjalne API-Football przechowuje pre-match odds tylko przez 7 dni.
Dlatego starszych rekordów nie da się później automatycznie odtworzyć z tego API;
trzeba je archiwizować w bazie w momencie skanowania, co obecny algorytm już robi.

SQL nie jest potrzebny.
