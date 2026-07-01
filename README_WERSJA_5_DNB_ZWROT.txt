BETAI — WERSJA 5

NAPRAWA GLOBALNEGO ROZLICZANIA DNB / REMIS NIE MA ZAKŁADU

Zmiany:
- DNB jest rozpoznawane przed rynkiem 1X2 / Match Winner.
- Remis w DNB zawsze daje VOID / ZWROT.
- Zwrot ma profit 0 oraz payout/return_amount równy stawce.
- Stare rekordy DNB zapisane błędnie jako match_winner są automatycznie ponownie sprawdzane.
- Po wdrożeniu istniejący błędnie wygrany/przegrany DNB zostanie naprawiony przy następnym automatycznym rozliczeniu.
- Poprawka obejmuje pojedyncze typy i nogi AKO rozliczane przez auto-settle-tips.
- Nie zmieniono wyglądu, botów AI, Supabase, płatności ani pozostałych rynków.

Przykład:
Belgia DNB, wynik Belgia 2:2 Senegal => VOID / ZWROT, profit 0, zwracana stawka.
