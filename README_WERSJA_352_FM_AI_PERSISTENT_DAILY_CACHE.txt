BET+AI WERSJA 352 — FM AI PERSISTENT DAILY CACHE

Cel:
Po pierwszym pełnym skanie FM AI użytkownik nie czeka ponownie po F5, zamknięciu karty lub ponownym wejściu na stronę tego samego dnia.

Co działa:
- dzisiejsze mecze, Value Scanner, ranking i Model Health są zapisywane lokalnie w przeglądarce,
- cache jest przywracany synchronicznie przy starcie strony — bez pustego ekranu i bez pełnego skanu od zera,
- cache jest osobny dla daty i strefy czasowej,
- rozpoczęte mecze nadal znikają automatycznie dzięki istniejącemu filtrowaniu pre-match,
- jeśli karta została zamknięta w trakcie skanu, V352 pokazuje zapis częściowy i wznawia brakującą analizę bez czyszczenia ekranu,
- użytkownik ma przycisk „ODŚWIEŻ ANALIZĘ”, który ręcznie uruchamia świeży skan, ale zachowuje stare wyniki na ekranie aż nowe będą gotowe,
- stara grafika kart meczów została zachowana 1:1,
- logika VALUE / EDGE / EV / CLV / calibration / Red Flag Guard nie została usunięta ani uproszczona.

Technicznie:
- localStorage: betai:fm-ai:daily-cache:v1:<date>:<timezone>
- zapis debounced po zmianach postępu/skanu,
- stan complete zapobiega ponownemu uruchamianiu pełnego skanu po poprawnie zakończonej analizie,
- przy zmianie dnia używany jest nowy cache i wykonywana jest nowa analiza.

Testy:
- TEST_WERSJA_347_FM_AI_MODEL_INTELLIGENCE.cjs
- TEST_WERSJA_352_FM_AI_PERSISTENT_CACHE.cjs
- syntax check JSX przez TypeScript transpileModule
