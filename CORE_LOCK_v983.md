# CORE LOCK v983

Od tej wersji NIE ruszamy tych elementów bez wyraźnej prośby:

## 1. Tożsamość profilu

Źródła prawdy:
1. `profile.id`
2. `author_id` / `user_id`
3. `email`
4. `public_slug`
5. `username`, ale tylko jeśli nie jest generic

Generic nazwy:
- `user`
- `użytkownik`
- `uzytkownik`

nie są prawdziwymi nickami i nie mogą mieszać profili.

## 2. Przypisywanie typów

Typ należy do użytkownika według kolejności:
1. `author_id` / `user_id`
2. email
3. nazwa tylko jeśli nie jest generic

## 3. Statystyki

Jedna zasada dla całej strony:

- `Typy` = wszystkie typy
- `Pending` = nierozliczone
- `Profit/Bilans` = tylko rozliczone
- `Stawka do Yield/ROI` = tylko rozliczone
- Pending nie wchodzi do Yield/ROI
- Wygrana = `stake * (odds - 1)`
- Przegrana = `-stake`
- Zwrot/pending = `0`

## 4. Ranking / Top typerzy

Ranking ma używać tych samych danych profilu i tych samych statystyk `imported_*`.

## 5. Realtime

UI ma aktualizować się bez F5:

- `tips INSERT` — nowy typ pojawia się od razu
- `tips UPDATE` — rozliczenie aktualizuje UI
- `tips DELETE` — typ znika
- `profiles UPDATE` — statystyki i ranking odświeżają się

## Zasada dla kolejnych wersji

Zmiany UI, wyglądu, przycisków, bannerów, tekstów albo układu nie mogą zmieniać tego rdzenia.

Ruszać tylko wtedy, gdy Paweł wyraźnie poprosi o zmianę logiki profili/statystyk/realtime.
