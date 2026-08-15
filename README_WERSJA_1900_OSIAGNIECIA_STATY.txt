WERSJA 1900 — NAPRAWA STATYSTYK ODZNAK

Problem:
- kafelki profilu liczyły bazę importowaną + nowe typy,
- tabela tipster_achievement_progress trzymała tylko starą bazę importu,
- dlatego profil pokazywał np. 848 typów / 492 wygrane,
  a osiągnięcia nadal 812 / 474.

Naprawa:
1. Frontend zawsze pokazuje większą wartość: bieżącą statystykę profilu lub zapisany postęp.
2. SQL poprawia kalkulator osiągnięć dla profili z imported_stats_additive=true.
3. Nowe typy po stats_imported_at są dodawane do historycznej bazy importu.
4. Postęp osiągnięć nie cofa się.

Wdrożenie:
1. Uruchom supabase/WERSJA_1900_ACHIEVEMENTS_STATS_SYNC.sql w Supabase SQL Editor.
2. Wgraj projekt na Netlify.
3. Clear cache and deploy site.
4. Ctrl+F5.
