BETAI WERSJA 1843 — TYPER EXPERT: PROBETTINGHUB + ŹRÓDŁA STATYSTYCZNE

Zmiana dotyczy wyłącznie silnika Typer Expert.

CO ZOSTAŁO DODANE
- ProBettingHub jest preferowanym źródłem danych statystycznych.
- Silnik próbuje sprawdzać dokładny mecz, drużyny albo ligę na stronach:
  * probettinghub.com/pl/matches
  * probettinghub.com/pl/betting-stats
- Bierze pod uwagę dostępne publicznie statystyki: forma, Hype/LTQ, xG, dom/wyjazd,
  wygrane, BTTS, Over/Under oraz okresy ostatnich 5/6/10/20 spotkań.
- SofaScore i Flashscore służą do sprawdzania bieżącej formy, wyników, składów,
  absencji, tabeli oraz statusu spotkania.
- Blogabet i Betfolio są wyłącznie dodatkowym sygnałem opinii. Jeden typer nie może
  sam zdecydować o publikacji typu.
- Silnik korzysta tylko z materiałów publicznych, widocznych bez logowania.
  Nie omija paywalli i nie kopiuje cudzych analiz.

NOWY FILTR JAKOŚCI
- Typ wymaga co najmniej jednego źródła statystycznego lub oficjalnego.
- ProBettingHub daje niewielki bonus jakości, gdy rzeczywiście zawiera dane dla meczu.
- Brak ProBettingHub nie blokuje automatycznie typu, jeśli istnieją inne wiarygodne dane.
- Sprzeczne informacje powodują odrzucenie kandydata.
- Końcowa analiza nadal ma maksymalnie 500 znaków.

HARMONOGRAM
00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00 i 21:00 UTC.
Silnik nadal publikuje maksymalnie jeden nierozliczony typ naraz.

ZMIENNE OPCJONALNE NETLIFY
TYPER_EXPERT_REQUIRE_STATS_SOURCE=true
TYPER_EXPERT_REQUIRE_PROBETTINGHUB=false
TYPER_EXPERT_PROBETTINGHUB_BONUS=4
TYPER_EXPERT_STATS_SOURCE_BONUS=2
TYPER_EXPERT_EXPERT_SOURCE_BONUS=1
TYPER_EXPERT_RESEARCH_CONTEXT_SIZE=medium

Nie ustawiaj REQUIRE_PROBETTINGHUB=true, jeśli chcesz, aby silnik mógł typować również
mecze, których ProBettingHub jeszcze nie posiada. Zalecana wartość to false.

TEST BEZ PUBLIKOWANIA
https://bet-ai.app/.netlify/functions/publish-typer-expert?dry_run=1

W odpowiedzi JSON sprawdź:
- research.probettingHubFound
- research.statsSourceFound
- research.expertSourceFound
- research.sourceNames
- research.sourceUrls
- research.statsSummary

WYMAGANE KLUCZE
- OPENAI_API_KEY
- APISPORTS_KEY / API_SPORTS_KEY / API_FOOTBALL_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

SQL nie jest potrzebny. insertSafe automatycznie pomija nowe pola badawcze, jeżeli nie
istnieją jako kolumny w tabeli tips.

WAŻNE
Dodatkowe źródła zwiększają ilość danych do oceny, ale nie gwarantują trafności ani zysku.
Progresja stawek również nie usuwa ryzyka długiej serii strat.
