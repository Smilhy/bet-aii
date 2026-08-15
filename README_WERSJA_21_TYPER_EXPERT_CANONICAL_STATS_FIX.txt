WERSJA 21 — TYPER EXPERT: JEDEN KANON STATYSTYK

Problem:
- Profil Typer Expert pokazywał 43.13% / +89.23.
- Kupon i Dashboard pokazywały 1.11% / +2.30.
- Powodem były dwa różne źródła danych: stary snapshot imported_* w profiles oraz realne rekordy kuponów w tips.

Naprawa:
1. Typer Expert jest liczony wyłącznie z aktualnych rekordów tabeli tips.
2. Stare imported_* i stare author_visible_stats nie mogą już nadpisywać realnie przeliczonego wyniku tego bota.
3. Ten sam kanon trafia do:
   - profilu i kafelków „Twoje statystyki”,
   - kart kuponów na profilu,
   - kart kuponów na Dashboardzie,
   - Top typerzy,
   - Rankingu,
   - sliderów / podsumowań korzystających z author_visible_stats.
4. Profit dla rozliczonych kuponów jest liczony zawsze według jednej zasady:
   - WIN = stawka × (kurs - 1)
   - LOSS = -stawka
   - VOID / PENDING = 0
   - Yield = suma profitu / suma stawek rozliczonych × 100
5. Bez zmian w SQL i bez zmian schematu Supabase.
