WERSJA 408 — STRICT AI PICKS ENGINE REBUILD

Cel:
- zatrzymać publikowanie słabych / wymuszonych typów w zakładce Typy AI
- oddzielić nową strategię od historycznych wyników starego silnika
- wybierać typ tylko wtedy, gdy przechodzi rygor jakości

Najważniejsze zmiany:
1. BetAI ma prawo zwrócić NO BET — brak obowiązku minimum 1 typu dziennie.
2. Wyłączone synthetic daily picks dla BetAI.
3. Wyłączony lokalny/hash fallback publikujący sztuczne probability/EV po błędzie endpointu.
4. Minimum 3 bukmacherów.
5. Minimum 52% prawdopodobieństwa modelowego.
6. Minimum +3.0% EV/edge.
7. Maksymalny spread probability między bukmacherami: 8 pp.
8. Minimalna jakość kandydata: 68/100.
9. Maksymalny kurs BetAI V408: 3.20 (ograniczenie wysokiej wariancji po słabych wynikach historii).
10. Wymagane niezależne potwierdzenie API-Football /predictions.
11. Probability 1X2 jest blendem konsensusu rynku i niezależnej prognozy API.
12. Rozszerzone rynki CORE:
   - 1X2: 1 / X / 2
   - Double Chance: 1X / X2 / 12
   - Over/Under 1.5
   - Over/Under 2.5
   - Over/Under 3.5
   - BTTS TAK / NIE
13. Double Chance probability liczone poprawnie z no-vig 1X2, a nie przez błędne sumowanie marży rynku DC.
14. Ranking V408 nie liczy drugi raz tych samych komponentów przez quality + probability + edge.
15. Aktywne typy V408 są izolowane source=betai_strict_value_v408.
16. Historyczne rekordy V407 i starsze pozostają w bazie i w widoku Historia, ale nie zanieczyszczają KPI V408.
17. Frontend nie modyfikuje już probability/EV V408 pseudo-losowym hashem.
18. Settlement rozpoznaje nowe source V408.

Ważne:
- V408 celowo NIE publikuje typu, gdy nie ma jakości.
- Pusta zakładka jest poprawnym wynikiem skanu, jeśli żaden rynek nie przejdzie filtrów.
- Nie dodano egzotycznych rynków, których obecne dane nie pozwalają jeszcze policzyć poprawnie (np. DNB/handicap/team totals wymagają osobnej matematyki EV i niezależnego modelu).
