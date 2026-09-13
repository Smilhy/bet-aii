WERSJA 391 — FEATURED MATCH INTELLIGENCE

Nowy profesjonalny moduł inspirowany referencją użytkownika został umieszczony w najlepszym miejscu UX:
- ekran „Przygotowanie meczu”
- bezpośrednio POD kompaktowym paskiem meczu / dużym przyciskiem „Uruchom symulację”
- PRZED istniejącym „Szybkie podsumowanie analizy”

Dlaczego tutaj:
- użytkownik najpierw widzi mecz i CTA,
- potem jeden duży wizualny overview AI,
- dopiero niżej przechodzi do pełnych, technicznych szczegółów,
- moduł nie zaśmieca LIVE symulacji.

V391 zawiera:
1. MECZ POD LUPĄ / FEATURED MATCH z ligą, datą, godziną i stadionem.
2. Logotypy obu drużyn i realną formę W/D/L z ostatnich meczów.
3. Panel SZANSE 1X2 z trzema probability bars.
4. AI VERDICT z rekomendowanym kierunkiem oraz stanem BET / WATCH / NO BET.
5. Pierścień CONFIDENCE oparty o reliability modelu.
6. FAIR ODDS, KURS RYNKU, EDGE i DATA QUALITY.
7. KLUCZOWE RYNKI — maks. 4 ważne rynki z kursem, bukmacherem i edge / probability.
8. Profesjonalny układ desktop/tablet/mobile dopasowany do istniejącego dark/cyan FM AI UI.
9. Brak statycznych danych Arsenal/Tottenham — moduł zawsze wykorzystuje aktualnie wybrany mecz.
10. Brak dodatkowych zapytań API i brak zmian w Supabase.

Zmodyfikowane pliki:
- src/MatchSimulatorPreparationView.jsx
- src/styles.css

Testy:
- TEST_WERSJA_390_IMMERSIVE_MATCH_EXPERIENCE.cjs — PASS 17/17
- TEST_WERSJA_391_FEATURED_MATCH_INTELLIGENCE.cjs — PASS 12/12
- kontrola balansowania delimiterów JSX/CSS — PASS
