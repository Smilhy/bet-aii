BetAI WERSJA 66 — stabilne liczniki Algorytmu

Znaleziony błąd:
get-algorithm-picks pobierał rekordy posortowane po kickoff i ograniczał wynik do 1500.
W tej samej tabeli są także setki rekordów no_bet / technicznych. Po kolejnych skanach
nowe rekordy wypychały najstarsze zakończone mecze poza limit, dlatego liczba:
- WYGRANE
- PRZEGRANE
- Wyniki
mogła z dnia na dzień SPADAĆ mimo że nic nie usunięto z bazy.

V66:
- W/L/void liczone są dokładnym COUNT z całej tabeli,
- zakończone wyniki pobierane są osobno od technicznych/no_bet,
- lista Wyniki jest scalana z pełną historią zakończonych zakładów,
- nowe skany nie mogą już zmniejszać liczników przez limit ostatnich rekordów,
- Profit/ROI liczone są z załadowanej historii rozliczonych zakładów,
- zakładka Wyniki pokazuje czytelny licznik „X wyników”.

Diagnostyka po wdrożeniu:
https://bet-ai.app/.netlify/functions/check-algorithm-counts-v66

SQL nie jest potrzebny.
