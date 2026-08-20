BetAI WERSJA 79 — płomień zbliżającego się meczu

Zmiana tylko wizualna w kartach typów na Dashboardzie:
- obok statusu „Oczekujący” jest płomień,
- >6h: prawie wygaszony,
- 6–3h: lekko aktywny,
- 3–1h: pomarańczowy, delikatnie pulsuje,
- 60–30 min: mocniejszy,
- 30–10 min: mocno świeci,
- <=10 min: najmocniejszy i szybszy puls,
- po rozpoczęciu płomień znika razem z trybem oczekującym,
- po najechaniu pokazuje „Start za X h Y min”.

Dashboard już miał wspólny zegar odświeżany co 30 sekund, więc V79 korzysta z niego i NIE dodaje osobnego timera do każdej karty. Dzięki temu efekt jest lekki także na telefonie.

Nie ruszono logiki typów, kont, Coinów, rankingu, statystyk ani Supabase.
