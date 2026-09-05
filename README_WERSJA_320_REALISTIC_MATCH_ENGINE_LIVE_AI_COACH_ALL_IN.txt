BET+AI — WERSJA 320
REALISTIC MATCH ENGINE 2D + LIVE AI COACH ALL-IN

CEL
V320 przebudowuje wyłącznie sam przebieg wizualnej symulacji meczu. Nie zastępuje i nie przelicza od zera istniejącego Prediction Engine.

ŹRÓDŁO SYMULACJI
V320 pobiera z przygotowanego profilu Bet+AI m.in.:
- xG home/away,
- skalibrowane 1/X/2,
- O1.5 / O2.5 / O3.5 / BTTS,
- attack/defence/form,
- posiadanie / expected shots,
- XI i formacje,
- Match Intelligence / fatigue, gdy dane istnieją.

ARCHITEKTURA
REALNE DANE -> BET+AI Prediction Engine -> zamrożony profil pre-match -> V320 Realistic Match Engine -> przebieg boiska -> LIVE AI Coach.

V320 REALISTIC MATCH ENGINE
- deterministyczny seed dla każdego scenariusza,
- nowy przycisk NOWY SCENARIUSZ tworzy inny seed przy tym samym profilu pre-match,
- batch kolejnych scenariuszy jest kalibrowany do istniejącego 1/X/2,
- jakość sytuacji jest kalibrowana do pre-match xG,
- ciągłe posiadania zamiast gotowych scenek,
- build-up / midfield progression / final third,
- krótkie i progresywne podania,
- through balls,
- crosses,
- dribbling,
- interception / turnover,
- pressing najbliższego obrońcy,
- dynamic formation shape,
- off-ball receiver runs,
- player separation,
- game state: drużyna przegrywająca później podnosi blok; prowadząca może chronić wynik,
- goalkeeper positioning i reakcja na realną trajektorię strzału,
- shot xG przypisany do faktycznie powstałej sytuacji,
- Canvas renderer zamiast przesuwania całego boiska przez DOM/CSS,
- nazwy zawodników wyłącznie z realnej/przewidywanej XI; brak fikcyjnych ratingów.

LIVE AI COACH
LIVE AI Coach bierze ten sam profil przedmeczowy i aktualizuje go wyłącznie tym, co zdarzyło się w bieżącej symulacji:
- wynik,
- czas,
- live xG,
- strzały,
- pressure ostatnich 10 min,
- final-third territory,
- game state,
- tempo sytuacji.

Pokazuje:
- live 1/X/2,
- O1.5 / O2.5 / O3.5,
- BTTS,
- gol w kolejnych 10 minut,
- prawdopodobieństwo strony następnego gola,
- TOP 3 kierunki,
- STRONG / WATCH / NO SIGNAL,
- Signal Strength 0–100,
- WHY NOW.

WAŻNE
LIVE AI Coach nie ma aktualnego kursu live bukmachera, dlatego nie udaje VALUE/EV. Sygnał oznacza najsilniejszy kierunek modelu w konkretnej symulacji, a nie gwarantowany zakład.

SUPABASE
SQL tworzy match_simulation_runs_v320. Po pełnym meczu frontend best-effort zapisuje seed, wersję Prediction Engine, profil pre-match, wynik i statystyki. Błąd zapisu nie zatrzymuje symulacji.

API
V320 nie dodaje nowych requestów API-Football. Korzysta z danych już przygotowanych przez istniejącą zakładkę Symulacja AI.

WDROŻENIE
1. Uruchom SUPABASE_RUN_ONCE_WERSJA_320_REALISTIC_MATCH_ENGINE_LIVE_AI_COACH.sql.
2. Wgraj ZIP V320 na Netlify.
3. Otwórz Symulacja AI -> przygotuj mecz -> uruchom symulację.
4. Przycisk ↺ powtarza ten sam seed; NOWY SCENARIUSZ tworzy nowy deterministyczny przebieg z tego samego profilu Bet+AI.
