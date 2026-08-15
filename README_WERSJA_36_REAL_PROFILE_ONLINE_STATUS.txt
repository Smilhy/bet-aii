WERSJA 36 — REALNY STATUS ONLINE/OFFLINE PROFILU

Zmiany:
- zielona kropka przy avatarze oznacza teraz realną aktywność użytkownika,
- status ONLINE jest aktywny tylko przy widocznej karcie i aktywności w ostatnich 2 minutach,
- po około 1–2 minutach bez aktywności status przechodzi na OFFLINE,
- OFFLINE ma czerwono-szarą kropkę,
- Podsumowanie pokazuje ONLINE/OFFLINE oraz realną ostatnią aktywność,
- używana jest istniejąca tabela Supabase presence_heartbeats,
- nie zmieniono logiki typów, statystyk, rankingu, algorytmu ani rozliczeń,
- nie potrzeba nowego SQL, jeśli działa już Live Chat / presence_heartbeats.
