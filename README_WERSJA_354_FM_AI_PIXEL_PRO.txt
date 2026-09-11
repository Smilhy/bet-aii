BET+AI WERSJA 354 — FM AI PIXEL PRO UI

Cel:
- przebudowa wyglądu zakładki FM AI zgodnie z zaakceptowanym mockupem
- zachowanie logiki V352: Value Scanner, cache dnia, loading progress, Why AI, pełna analiza, symulator
- brak zmian w backendzie i regułach wyliczeń

Najważniejsze zmiany UI:
- pełnoszeroki layout FM AI bez wewnętrznego bocznego panelu sportu
- nowy nagłówek i toolbar z wyszukiwaniem, live data i odświeżaniem analizy
- nowa karta TOP TYP DNIA z logo drużyn, typem, kursem, szansą AI, oceną, werdyktem, pewnością i ryzykiem
- 4 kafle KPI + Kondycja modelu z okrągłym wskaźnikiem
- kompaktowe TOP 4 najlepsze okazje dnia zgodnie z mockupem
- wektorowe ikonki SVG w UI, bez emoji w głównych kartach
- Analityka PRO pozostaje dostępna przyciskiem
- istniejące pełne karty meczów zostały zachowane niżej na stronie i tylko wizualnie uspokojone

Zmodyfikowane pliki:
- src/MatchSimulatorDailyMatchesView.jsx
- src/styles.css
- package.json

Testy:
- TypeScript JSX syntax parse: OK
- TEST_WERSJA_347_FM_AI_MODEL_INTELLIGENCE.cjs: OK
