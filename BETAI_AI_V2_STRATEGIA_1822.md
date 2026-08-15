# BetAI MultiSport AI — strategia V2 (wersja 1822)

Ta zmiana dotyczy wyłącznie profilu `BetAI MultiSport AI` / `betai-multisport-ai`.
Frontend, kupony innych użytkowników, ranking i pozostałe konta nie zostały zmienione.

## Co robi nowy silnik

- tylko prawdziwe kursy API-Football; brak kursów syntetycznych,
- tylko piłka nożna seniorów,
- odrzuca młodzież, rezerwy, kobiety, sparingi, ligi amatorskie i regionalne,
- porównuje kursy minimum 5 bukmacherów,
- usuwa marżę z każdej pełnej linii rynku,
- liczy medianę prawdopodobieństwa rynkowego,
- odrzuca odstający/stary kurs,
- wymaga co najmniej 4,5% oczekiwanej przewagi,
- zakres kursów 1.55–2.35,
- odrzuca remisy, undery i podwójną szansę,
- dopuszcza tylko: wygrana gospodarzy/gości, over 2.5, BTTS TAK,
- maksymalnie 1 typ na 20 godzin,
- maksymalnie 1 typ na mecz,
- niczego nie publikuje, gdy nie ma wystarczającej jakości.

## Harmonogram

Skany: 07:17, 11:17 i 15:17 UTC. Blokada konta pozwala opublikować maksymalnie jeden typ w ciągu 20 godzin.

## Stary generator

`generate-live-ai-picks.js` jest domyślnie wyłączony i nie może mieszać swoich typów z V2.
Można go uruchomić tylko świadomie przez `BETAI_ENABLE_LEGACY_MULTI_AI=1` — nie jest to zalecane.

## Test ręczny bez publikacji

Wywołaj:

`/.netlify/functions/publish-betai-multisport-ai?dry_run=1`

Zwróci kandydatów i filtry, ale niczego nie zapisze do bazy.

## Ważne

Silnik jest zaprojektowany do selekcji dodatniej wartości oczekiwanej, ale nie gwarantuje zysku. Wynik należy oceniać na dużej próbie, a nie po kilku zakładach.
