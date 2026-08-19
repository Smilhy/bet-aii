BetAI WERSJA 77 — prawa kolumna: pełne statystyki Typer Expert / Ograć Buka

Przyczyna błędu:
- Dashboard/Ranking pobierał globalnie tylko ostatnie 500 rekordów z tabeli tips.
- smilhytv ma ponad 900 kuponów, więc starsze rekordy Typer Expert i Ograć Buka wypadały poza okno.
- dlatego prawa kolumna widziała czasem tylko 1 aktualny rekord danego bota i pokazywała np.:
  Ograć Buka: 100% yield / 1 kupon
  Typer Expert: 71% yield / 1 kupon
  mimo że ich profile miały pełne 47 / 32 kupony.

Naprawa V77:
- zachowuje V76 hard account isolation,
- globalny feed nadal pobiera tylko 500 rekordów (bez zwiększania egress),
- osobno pobierana jest tylko pełna historia dwóch systemowych typerów:
  Typer Expert i Ograć Buka,
- rekordy są deduplikowane po id / fixture / pick / kickoff,
- prawy slider Najlepsi/Płatni/Seria/Popularni oraz Ranking korzystają z pełnych kanonicznych statystyk,
- profil i prawa kolumna powinny pokazywać ten sam totalTips / W/L / yield / profit.

Nie zmieniono:
- Coinów,
- logowania,
- Algorytmu,
- rozliczania,
- progresji,
- UI rankingu/podium.

SQL nie jest potrzebny.
