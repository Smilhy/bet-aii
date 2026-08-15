WERSJA 1895 — NAPRAWA PROGRESJI TYPER EXPERT

Problem:
- typ był oznaczony jako przegrany,
- ale w części rekordów kolumna profit pozostawała 0,
- silnik progresji traktował to 0 jako prawidłowy wynik,
- dlatego kolejna stawka wracała do 1.00 zamiast wzrosnąć.

Naprawa:
- status won/lost jest teraz źródłem prawdy,
- lost z profit 0 jest liczony jako -stawka,
- won z profit 0 jest liczony jako stawka * (kurs - 1),
- aktualny oczekujący typ może zostać automatycznie skorygowany przez istniejący repair progresji,
  o ile mecz jeszcze się nie rozpoczął.

Przykład:
- poprzednia przegrana: stawka 1.00, kurs 1.78,
- bilans cyklu: -1.00,
- cel cyklu: +0.40,
- następna stawka przy kursie 1.78: 1.80.

SQL nie jest wymagany.
Po wdrożeniu użyj Netlify: Clear cache and deploy site.
