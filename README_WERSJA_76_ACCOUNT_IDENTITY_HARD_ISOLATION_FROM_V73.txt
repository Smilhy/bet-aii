BetAI WERSJA 76 — HARD ISOLATION kont smilhytv / buchajson1988
BAZA: bezpośrednio WERSJA 73 (ostatnia dobra wersja użytkownika).

OBJAW:
- po przełączeniu smilhytv -> buchajson1988 -> smilhytv przez kilka sekund było dobrze,
  a później UI potrafił przeskoczyć na Coiny/statystyki/profil drugiego konta,
- kliknięcie profilu buchajson1988 mogło otwierać smilhytv,
- prawa kolumna rankingu potrafiła pokazywać statystyki przypisane do złej tożsamości.

PRZYCZYNY ZNALEZIONE W V73:
1. opóźnione requesty/timery poprzedniego konta mogły zrobić setState po zmianie konta,
2. accountProfile mógł być scalany z nową sesją i stary profil miał pierwszeństwo w części pól,
3. fetchUserPlan mieszał przekazany userId z bieżącym sessionUser.email,
4. lokalny Coin cache i Math.max mogły przenieść większe saldo starego konta do nowego UI,
5. ranking/profile merge traktował email/username jako silniejsze lub równorzędne z UUID,
   więc stary alias mógł skleić dwa różne konta,
6. canonical stats mogły spaść z niezgodnego UUID do username/email i policzyć cudze typy,
7. profile realtime mógł aktualizować własny profil zbyt szerokim dopasowaniem aliasów.

NAPRAWA V76:
- auth UUID + auth email tworzą aktywną tożsamość i numer generacji (epoch),
- każdy opóźniony request poprzedniego konta jest ignorowany,
- przy zmianie konta czyszczony jest cały account-scoped UI,
- Coiny z Supabase są źródłem prawdy; brak Math.max z saldem poprzedniego konta,
- cache Coinów i avatarów skażony wcześniejszym przełączaniem jest jednorazowo czyszczony,
- fetchUserPlan używa jednego snapshotu identity i nie robi automatycznego upsertu profilu,
- UUID ma absolutne pierwszeństwo w rankingu, profilach, statystykach i klikaniu profilu,
- dwa różne UUID nigdy nie mogą zostać scalone przez wspólny/stary username albo email,
- kliknięcie 'czy to mój profil' jest liczone wyłącznie z aktualnej sesji auth,
- TOKEN_REFRESHED nie może zmienić aplikacji na innego usera,
- spóźniony getSession nie może cofnąć zalogowanego konta,
- realtime wallet/profile jest przypięty do konkretnego id/email/epoch.

DIAGNOSTYKA SUPABASE (TYLKO ODCZYT):
https://bet-ai.app/.netlify/functions/check-account-isolation-v76

Endpoint sprawdza auth -> profiles -> wallet dla:
- smilhytv@gmail.com
- buchajson1988@gmail.com
oraz czy wallet jest przypięty do właściwego auth user_id i czy profil ma właściwy email/username.
Sprawdza też zgodność salda walleta z ledgerem transakcji, ale nie publikuje samego salda.

Jeżeli supabase_identity_healthy=true:
- rekordy identity w Supabase są poprawne; błąd był frontend/race/cache.

Jeżeli false:
- nie wykonujemy automatycznej naprawy bazy. Najpierw należy przejrzeć JSON,
  żeby nie nadpisać poprawnych danych złego konta.

BRAK SQL.
Nie zmieniano algorytmu, sposobu typowania, progresji Typer Expert ani wyglądu V73.
