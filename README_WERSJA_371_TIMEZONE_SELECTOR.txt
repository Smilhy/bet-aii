BET+AI — WERSJA 371 — GLOBAL TIME ZONE SELECTOR

Zmiany:
- nowy wybór strefy czasowej obok przełącznika języka w topbarze,
- automatyczne wykrywanie strefy czasowej przeglądarki przy pierwszym uruchomieniu,
- możliwość ręcznego wyboru miasta/strefy z listy światowej,
- wyszukiwarka miast i krajów w selektorze,
- podgląd aktualnej godziny i offsetu GMT dla każdej strefy,
- wybór zapisywany w localStorage jako betai_timezone,
- godzina oraz data kickoffu na kartach/kuponach Dashboardu przeliczają się natychmiast,
- poprawna obsługa zmiany dnia przy dużej różnicy stref (np. Tokio/Australia),
- stare ręczne czasy bez jawnej strefy są interpretowane jako Europe/Warsaw i dopiero konwertowane,
- obsługa DST/czasu letniego przez Intl/IANA time zones,
- nie wymaga żadnego SQL ani zmian Supabase.

Przykład:
Mecz zapisany jako 12.09.2026 21:00 Europe/Warsaw:
- Warszawa: 21:00
- Londyn: 20:00
- Nowy Jork: 15:00
- Tokio: 04:00 dnia następnego

V371 bazuje na V370 i nie zmienia logiki typów, kursów, rozliczeń ani FM AI.
