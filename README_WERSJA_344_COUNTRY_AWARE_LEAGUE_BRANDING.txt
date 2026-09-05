WERSJA 344 — COUNTRY-AWARE LEAGUE BRANDING

Baza: V343 (czyli V341 + pojedyncza data + font ligi +2 px).

Poprawka:
- Serie A + Brazylia => brazylijska Serie A (API-Football league 71) + flaga Brazylii.
- Serie B + Brazylia => brazylijska Serie B (API-Football league 72) + flaga Brazylii.
- Serie A/B + Włochy pozostają włoskie (135/136).
- Gdy kraj jest jawnie zapisany przy typie, ma pierwszeństwo przed samą nazwą ligi.
- Dla tych niejednoznacznych lig poprawny branding ma pierwszeństwo przed ewentualnym starym błędnym league_logo.

Brak zmian w logice typów, kursów, FM AI, Supabase i API. SQL niepotrzebny.
