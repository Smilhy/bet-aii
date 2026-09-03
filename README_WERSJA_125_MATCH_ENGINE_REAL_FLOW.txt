WERSJA 125 — LIVE MATCH ENGINE REAL FLOW
Baza: WERSJA 124

Najważniejsze zmiany:
- zawodnik posiadający piłkę prowadzi ją przy markerze
- piłka odłącza się od zawodnika tylko przy podaniu / strzale / rożnym
- logiczne sekwencje akcji: wyprowadzenie od tyłu -> podanie -> prowadzenie -> wejście w ostatnią tercję -> cofnięcie lub strata
- realna zmiana posiadania po stracie
- ustawienie zespołu przesuwa się wraz z akcją i linią piłki
- wydarzenia modelu (strzał, gol, rożny, kartka) przejmują przebieg animacji w odpowiednim momencie
- przy golu piłka dochodzi do faktycznej bramki / siatki
- animacja siatki przy golu
- overlay gola: GOOOL + realne nazwisko strzelca z oficjalnego XI + minuta + drużyna
- po golu piłka wraca na środek i przeciwnik wznawia grę
- krótki ekran PRZERWA przy 45. minucie
- FULL TIME z wynikiem oraz prawdopodobieństwami modelu i realną liczbą symulacji Monte Carlo
- poprawiona piłka SVG: mniejsza przy prowadzeniu, obrót podczas podań/strzałów
- trajektoria jest widoczna tylko kiedy piłka naprawdę przemieszcza się między zawodnikami
- subtelne przybliżenie boiska w groźnych akcjach

Zasady danych:
- nazwy zawodników pochodzą wyłącznie z oficjalnego składu API-Football
- brak oficjalnego XI = brak fikcyjnych zawodników
- kolory strojów nadal pobierane są z API-Football, z bezpiecznym fallbackiem
- zdarzenia symulacji są generowane przez model Bet+AI na podstawie realnych danych wejściowych; nie są deklarowane jako faktyczny przyszły przebieg meczu
