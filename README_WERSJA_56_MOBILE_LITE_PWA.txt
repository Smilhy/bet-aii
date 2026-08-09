BetAI WERSJA 56 — MOBILE LITE / PWA

Cel: telefon ma otwierać stronę szybko jak aplikację, bez uruchamiania ciężkiego desktopowego Dashboardu.

Zmiany:
1. Nowa lekka aplikacja: https://bet-ai.app/app/
2. Telefony na zwykłym https://bet-ai.app/ są automatycznie kierowane do /app/.
3. Desktop pozostaje bez zmian.
4. Przycisk "Pełna wersja" otwiera /?desktop=1 i omija mobilne przekierowanie.
5. Mobile Lite nie ładuje głównego 1.8 MB main.jsx ani 3.6 MB styles.css.
6. Dane są ładowane progresywnie:
   - start: sesja + profil + Coin + mała paczka typów,
   - ranking dopiero po kliknięciu Ranking,
   - Live Chat dopiero po kliknięciu Czat,
   - brak stałego pollingu co 15/30/45 sekund.
7. Live Chat w Mobile Lite używa realtime tylko podczas otwartej zakładki Czat.
8. Dodany PWA manifest + service worker. Można dodać Bet+AI do ekranu głównego i otwierać jak aplikację.
9. Cache ostatnich podstawowych danych daje szybszy ekran po ponownym wejściu.
10. Brak zmian w typach, kursach, rozliczeniach, botach, algorytmie i bazie Supabase. SQL nie jest potrzebny.

Test telefonu:
- otwórz https://bet-ai.app/ — telefon powinien przejść do /app/,
- w Chrome: menu ⋮ > Dodaj do ekranu głównego / Zainstaluj aplikację,
- pełną wersję można uruchomić przyciskiem "Pełna wersja".
