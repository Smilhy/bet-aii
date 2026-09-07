BET+AI V345 — FM AI SKIP INTRO

Baza: V344.

Zmiana:
- Po kliknięciu FM AI aplikacja nie pokazuje już sztucznego 5.2 s intro/loading bannera.
- Widok otwiera od razu listę meczów (stage: matches).
- Realne pobieranie danych/API pozostaje bez zmian i odbywa się normalnie w odpowiednich widokach.
- Komponent intro NIE został usunięty z projektu. Można go łatwo przywrócić, zmieniając:
  SHOW_FM_AI_INTRO_V345 = false
  na:
  SHOW_FM_AI_INTRO_V345 = true

Nie zmieniono:
- modelu AI,
- API-Football,
- Supabase,
- Prediction Engine,
- Match Engine V320,
- whitelisty lig,
- wyglądu pozostałych ekranów.

SQL: niepotrzebny.
