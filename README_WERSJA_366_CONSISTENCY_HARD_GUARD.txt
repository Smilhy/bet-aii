WERSJA 366 — FM AI CONSISTENCY HARD GUARD

Naprawa przypadku: Top Typ = Over 2.5 72.2%, a wizualna symulacja kończy się 1:1.

Zmiany:
- normalizacja historycznych/alternatywnych kluczy rynku (over2.5, over_25, over25 itd.)
- dashboard przekazuje canonical market key + rawKey do wspólnego snapshotu
- Preparation View blokuje właściwy rynek do tej samej wartości prawdopodobieństwa
- MatchSimulator wybiera najbardziej prawdopodobny scoreline zgodny z top pickiem
- HARD GUARD gwarantuje zgodność reprezentatywnego wyniku wizualnego, jeśli top pick >=55%
- Monte Carlo nadal pozostaje probabilistyczne i nie jest fałszowane przez ten guard
