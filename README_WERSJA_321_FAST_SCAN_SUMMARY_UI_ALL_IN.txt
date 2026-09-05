Bet+AI WERSJA 321 — FAST SCAN SUMMARY UI ALL-IN

CEL
- Uporządkowanie ekranu przygotowania meczu bez zmiany Prediction Engine.
- Najważniejsze wnioski są teraz widoczne od razu pod nagłówkiem meczu.

NOWY PANEL V321
- FINALNA DECYZJA MODELU: BET / WATCH / NO BET — dokładnie z istniejącego Professional Prediction Lab.
- Najmocniejszy kierunek modelu + procent + fair odds + edge po kontroli, jeśli dostępny.
- 3 najmocniejsze rynki bramkowe z istniejącej prognozy.
- xG obu drużyn.
- Wiarygodność, Data Quality, próbka kalibracyjna i najlepszy kierunek 1X2.
- 5 automatycznych, krótkich powodów z istniejących danych modelu.
- Duży przycisk „Uruchom symulację” na górze.
- Przycisk „Pokaż pełną analizę” przewija do dotychczasowej szczegółowej analizy.

WAŻNE
- V321 to wyłącznie UI / hierarchia informacji.
- Nie zmieniono matematyki, kalibracji, xG, Poissona, Dixon-Coles, Champion/Challenger, Value Engine, Reliability, V260, V280, V300 ani V320.
- Nie ma nowej migracji Supabase. SQL NIE JEST POTRZEBNY.
- Dotychczasowe szczegółowe moduły pozostają na stronie.
- Jeśli decyzja systemu to NO BET, panel pokazuje kierunki jako informacyjne i wyraźnie nie zamienia ich w rekomendację BET.

WDROŻENIE
1. Nie uruchamiaj żadnego nowego SQL.
2. Wgraj ZIP V321 na Netlify jak poprzednią wersję.
3. Otwórz Symulacje -> wybierz mecz -> po zbudowaniu forecastu panel FAST SCAN pojawi się pod nagłówkiem meczu.

PLIKI ZMIENIONE
- src/MatchSimulatorPreparationView.jsx
- src/styles.css
- package.json (wersja/nazwa)

TESTY
- TEST_V320_OK — PASS
- TEST_V300_OK — PASS
- TEST_V280_OK — PASS
- TEST_V260_OK — PASS
- TEST_V200_RELIABILITY_DATA_SCIENCE — PASS
- Pełnego npm/Vite build nie oznaczono jako zaliczonego: npm install w środowisku roboczym przekroczył limit czasu.
