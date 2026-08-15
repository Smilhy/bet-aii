BETAI WERSJA 1867.4 — NAPRAWA BOTÓW AI I HARMONOGRAMÓW

Baza: ostatnia dobra wersja 1867 + poprawki AI 1867.3.
Logika strony, logowanie, płatności i pozostałe moduły nie zostały usunięte.

NAPRAWIONE:
1. Długie skany botów nie działają już bezpośrednio jako 30-sekundowe Scheduled Functions.
   Harmonogram uruchamia lekki trigger, a analiza działa jako Netlify Background Function.
2. Przycisk Odśwież dziś wywołuje zwykły endpoint, który kolejkuje skan w tle i czeka na zapis w Supabase.
3. Zakres kursów 1.50–5.00 jest realny: obniżono blokujący próg prawdopodobieństwa, który wcześniej praktycznie odcinał kursy powyżej około 2.00–2.40.
4. BetAI MultiSport AI: minimum 2 bukmacherów, próg prawdopodobieństwa 18%, minimalne value 0.5%, cooldown 6 h.
5. Typer Expert: łagodniejsze filtry rynku, API-Football jest używane jako ocena dodatkowa, a nie bezwzględna blokada każdego typu.
6. Ograć Buka: nadal selektywny i potwierdzany przez API, ale z dynamicznym progiem zależnym od kursu.
7. Stare nierozliczone rekordy nie blokują profilu bez końca po wielu godzinach od meczu.
8. Każdy skan bez kandydata, cooldown lub błąd zapisuje diagnostykę do ai_pick_runs.
9. Zmniejszono liczbę skanów i stron odds, żeby nie wyczerpywać niepotrzebnie limitu API.

HARMONOGRAM UTC:
- BetAI MultiSport AI: 06:17, 12:17, 18:17
- Typer Expert: 07:27, 13:27, 19:27
- Ograć Buka: 08:37, 14:37, 20:37

WYMAGANE ENV W NETLIFY:
- SUPABASE_URL lub VITE_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY lub SUPABASE_SERVICE_KEY
- APISPORTS_KEY lub API_SPORTS_KEY lub API_FOOTBALL_KEY

Nie wymaga nowego SQL.
