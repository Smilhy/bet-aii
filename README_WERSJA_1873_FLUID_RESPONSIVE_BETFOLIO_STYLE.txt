WERSJA 1873 — FLUID RESPONSIVE LOGIN + PANEL

Najważniejsze zmiany:
- całkowicie usunięto skrypty AUTO ZOOM 75%, 80% i sztuczny viewport 50% dla tabletów,
- usunięto provider wymuszający CSS zoom po uruchomieniu aplikacji,
- ekran logowania skaluje się natywnie bez zoomu i bez transformacji całego UI,
- panel po zalogowaniu używa płynnej siatki: sidebar / treść / rightbar,
- prawa kolumna przechodzi pod treść na średnich laptopach zamiast być ucinana,
- tablet i telefon przechodzą do układu jednokolumnowego,
- dodano natywne zakresy dla Full HD, 2K, 4K i ultrawide,
- zachowano logowanie, rejestrację, Supabase, reset hasła i routing bez zmian.

Wdrożenie:
- nie trzeba uruchamiać SQL,
- wdrażaj tak samo jak wcześniejszą wersję,
- po wdrożeniu wykonaj Ctrl+F5.
