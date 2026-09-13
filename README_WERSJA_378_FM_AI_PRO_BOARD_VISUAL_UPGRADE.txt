WERSJA 378 — FM AI PRO OPPORTUNITY BOARD • VISUAL TERMINAL UPGRADE

Zmiana dotyczy tylko front-endu zakładki FM AI i sekcji PRO OPPORTUNITY BOARD.
Nie dodaje nowych requestów API i nie wymaga zmian w Supabase.

CO ZMIENIONE:
- nowy profesjonalny header w stylu terminala rynkowego
- LIVE MARKET SCREEN + licznik widocznych okazji
- 5 KPI: aktywne okazje, Strong/Value, średnia szansa AI, top edge, średnia jakość
- osobny panel sterowania filtrami + przycisk RESETUJ
- tabela przebudowana wizualnie: ranking, badge decyzji, progress bary AI/EDGE/EV/REL
- wyróżnienie top 3 wierszy i kolorowe akcenty VALUE / STRONG VALUE
- bardziej czytelny bookmaker / kurs / stan rynku
- nowe przyciski WHY AI / OTWÓRZ z ikonami
- pełna responsywność desktop/tablet/mobile
- zachowana istniejąca logika V377, wszystkie callbacki i dane

PLIKI ZMIENIONE:
- src/FmAiProMarketSuiteV377.jsx
- src/styles.css

SUPABASE:
- NIC NIE URUCHAMIAJ. Brak nowego SQL.

NETLIFY:
- standardowy deploy całej wersji strony.
