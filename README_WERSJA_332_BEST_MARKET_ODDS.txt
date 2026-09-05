WERSJA 332 — BEST MARKET + ODDS ON MATCH CARDS

Zmiany:
- miejsce „Brak kursów” zostało przebudowane na panel najlepszego rynku dla danego meczu,
- gdy Value Scanner ma realny kurs bukmachera: panel pokazuje NAJLEPSZY RYNEK AI + realny kurs + FAIR + prawdopodobieństwo,
- gdy realnego kursu brak, ale model policzył mecz: panel pokazuje NAJMOCNIEJSZY KIERUNEK AI + prawdopodobieństwo + FAIR AI,
- FAIR AI jest wyraźnie opisany jako kurs modelu, nie jako realny kurs bukmachera,
- jeśli skan jeszcze trwa, widoczny jest status „Analizuję rynek…”,
- nie dodano nowych requestów API: V332 wykorzystuje dane i /odds już pobierane przez Value Scanner,
- V331 czytelność lig i czarny napis Symuluj pozostają zachowane,
- nie zmieniono Prediction Engine, V320 ani whitelisty 17 lig.

Przykład:
NAJLEPSZY RYNEK AI
1X2 • 2   Wygra RB Leipzig
AI 48.6%   KURS @2.18
Realny kurs • FAIR 2.06

Jeżeli brak kursu rynkowego:
NAJMOCNIEJSZY KIERUNEK AI
OVER 1.5   Powyżej 1.5 gola
AI 82.4%   FAIR AI 1.21
Brak kursu rynkowego • FAIR modelu

SQL: nie jest potrzebny.
