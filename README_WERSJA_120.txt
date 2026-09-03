WERSJA 120 — naprawa listy meczów dnia

Diagnoza:
- widok dnia używał forceRefresh=1,
- backend przed zwrotem listy pobierał pełne dane fixtures oraz wiele stron /odds,
- przy dużej liczbie meczów request mógł przekroczyć czas wykonania Netlify,
- UI pokazywał wtedy „Nie udało się pobrać realnych meczów”.

Naprawa:
- najpierw używany jest szybki cache,
- przy braku cache robione jest świeże pobranie,
- liczba stron /odds dla all-today została ograniczona,
- jeśli kursy chwilowo blokują request, fallback pobiera prawdziwe fixture'y bez /odds,
- brak kursów nie usuwa meczu z listy,
- bez fake/demo,
- nadal tylko dzisiejsze nierozpoczęte mecze, sortowane po kickoffie.
