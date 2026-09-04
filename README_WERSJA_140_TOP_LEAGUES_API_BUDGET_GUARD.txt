BET+AI WERSJA 140 — TOP LEAGUES + API BUDGET GUARD

Najważniejsze:
- Symulator AI skanuje tylko topowe ligi + Polską Ekstraklasę.
- Nie skanuje wszystkich setek meczów dnia.
- Maksymalnie 60 meczów trafia do kwalifikacji.
- AI Value Scanner analizuje maksymalnie 24 najbliższe zakwalifikowane mecze.
- Brak składu XI nadal NIE blokuje meczu.
- Cache/Supabase nadal jest pierwszym źródłem.
- Nowy dzienny budżet dotyczy tylko Symulatora AI, żeby nie zabierać limitu innym modułom strony.
- Domyślnie Symulator ma łącznie maks. 750 świeżych prób API/dzień.
- Value Scanner ma własny limit 240/dzień.
- Trafienia w cache nie zużywają tego budżetu.

Top ligi:
Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1,
Eredivisie, Primeira Liga/Liga Portugal, Belgian Pro League,
Scottish Premiership, POLSKA EKSTRAKLASA,
UEFA Champions League, Europa League, Conference League.

WAŻNE:
Uruchom raz:
SUPABASE_RUN_ONCE_WERSJA_140_API_BUDGET_GUARD.sql

Ta wersja celowo zostawia zdecydowaną większość planu API-FOOTBALL dla innych
funkcji Bet+AI: Typy AI, algorytm, live scores, settlementy i pozostałe moduły.
