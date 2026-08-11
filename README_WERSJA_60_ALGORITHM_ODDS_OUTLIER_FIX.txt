BetAI WERSJA 60 — Algorytm: poprawka błędnych/skrajnych kursów Over/Under 2.5

Problem:
- V59 pokazywała dla PSG – Aston Villa kurs Over 2.5 = 4.50,
  podczas gdy rynek pokazywał około 1.73–1.83.
- Przyczyną było wybieranie bezwarunkowo najwyższego kursu zwróconego przez API.
- Jeden błędny rekord bukmachera/API mógł więc wygrać jako „best odds”.

Naprawa V60:
- dla 3+ kursów liczona jest mediana rynku,
- pojedyncze skrajne wartości poza rozsądnym zakresem względem mediany są odrzucane,
- następnie wybierany jest najwyższy kurs z wiarygodnej grupy,
- dla 2 kursów bardzo duża rozbieżność (>= 60%) jest traktowana jako outlier,
- liczba dostępnych bookmakerów nadal pokazuje cały rynek.

Przykład testowy:
1.83, 1.83, 1.80, 1.80, 1.77, 1.80, 1.73, 4.50
=> mediana ~1.80, 4.50 zostaje odrzucone, najlepszy wiarygodny kurs = 1.83.

Nie zmieniono:
- wzoru i prawdopodobieństwa algorytmu,
- logiki wyboru Over/Under,
- progu 51%,
- minimum kursu 2.00,
- stawek i rozliczeń.

Po wdrożeniu kolejny skan pre-match odświeży over_odds/under_odds dla przyszłych meczów.
SQL nie jest potrzebny.
