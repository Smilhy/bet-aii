WERSJA 398 — CANONICAL SIGNAL FIX

Naprawia najważniejszy problem logiczny/UX:
- jeden zamrożony top pick z tablicy jest używany jako główny sygnał w przygotowaniu i LIVE
- karta Featured Match nie wybiera już innego rynku jako głównego werdyktu
- rynki UNDER / OVER / BTTS NO są obsługiwane jako pełnoprawny główny pick
- VALUE nie jest już mylone z wysokim prawdopodobieństwem trafienia

Nowa semantyka sygnałów:
- <40%: VALUE • WYSOKIE RYZYKO
- 40–54.9%: VALUE • DO ROZWAŻENIA
- >=55%: może dostać GRAJ / MOCNO GRAJ zależnie od jakości/edge

LIVE:
- pokazuje procent zamrożonego sygnału + poziom ryzyka
- po zakończeniu symulacji pokazuje, czy TEN KONKRETNY scenariusz trafił/nie trafił sygnału
- pojedyncza symulacja nie jest traktowana jako nowa prognoza

Zmodyfikowane:
- src/FmAiProMarketSuiteV377.jsx
- src/MatchSimulatorPreparationView.jsx
- src/MatchSimulatorView.jsx
- src/styles.css
