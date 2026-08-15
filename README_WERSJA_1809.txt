BetAI WERSJA 1809 — WYKRES SALDA Z AKTUALNYCH STATYSTYK TYPERA

Zmiana dotyczy wykresu w:
- Mój profil -> Wyniki
- Mój profil -> Statystyki

Źródło danych:
- wyłącznie realne typy użytkownika zapisane w Supabase,
- tylko typy rozliczone: wygrany, przegrany lub zwrot,
- brak danych i historii z Betfolio,
- brak importowanych miesięcy i sztucznej krzywej.

Logika:
- wygrany: zapisany profit z rekordu, a gdy go brak: stawka × (kurs - 1),
- przegrany: zapisany profit z rekordu, a gdy go brak: -stawka,
- zwrot: 0,
- pending: nie pojawia się na wykresie,
- kolejność według daty rozliczenia/aktualizacji/meczu,
- zakres 7D/30D/90D/1R/Wszystko przycina widok, ale saldo pozostaje kumulacyjne.

Nie wymaga SQL. Wgraj folder dist na Netlify.
