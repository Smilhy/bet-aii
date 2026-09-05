BET+AI WERSJA 328 — ULTRA PRO MATCH CARDS 1:1

CEL
Przeniesienie zatwierdzonego mockupu kafli Symulacji AI do realnego działającego frontendu.

CO ZMIENIONO
- nowy premium layout każdej karty meczu,
- prawdziwe logo ligi z istniejącego payloadu API-Football (leagueLogo),
- flaga kraju / fallback emoji,
- większe herby drużyn,
- nazwa ligi + kraj + opis poziomu rozgrywek,
- etykiety GOSPODARZE / GOŚCIE,
- duża godzina meczu,
- stadion i miasto, jeśli API je zwraca,
- panel kursów 1/X/2 albo "Brak kursów / Dostępne wkrótce",
- duży neonowy przycisk Symuluj,
- specjalne podświetlenie najbliższego meczu,
- pełne responsywne zachowanie desktop/tablet/mobile,
- styl: dark navy + cyan neon + glass cards + delikatne stadium/tech gradients.

NIE ZMIENIONO
- whitelisty 17 rozgrywek V327,
- pełnego dnia meczowego V327,
- logiki Prediction Engine,
- xG / probabilities / Value Scanner,
- V320 Match Engine,
- requestów API i budżetu API.

NOWE REQUESTY API: 0
SQL: NIEPOTRZEBNY

ZMIENIONE PLIKI
- src/MatchSimulatorDailyMatchesView.jsx
- src/styles.css
- package.json (tylko nazwa/wersja paczki)
