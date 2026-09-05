Bet+AI WERSJA 322 — ULTRA PRO FAST SCAN UI

CEL
- przebudowa WYŁĄCZNIE warstwy wizualnej ekranu Przygotowanie meczu
- brak zmian w Prediction Engine, kalibracji, Value Engine, decyzjach BET/WATCH/NO BET i Match Engine V320

CO ZMIENIONO
1. Premium hero meczu: logo ligi z istniejącego payloadu API-Football, kraj/liga/runda, duże herby, data/godzina oraz stadion/miasto jeśli API je zwraca.
2. Executive Match Brief V322: większa typografia, profesjonalne SVG ikony, lepsza hierarchia, wyraźna decyzja modelu i najmocniejsze kierunki.
3. Sekcja xG / Reliability / Data Quality / Calibration / 1X2 została uporządkowana jako skanowalne KPI.
4. Najważniejsze powody mają nową hierarchię i czytelniejszy układ.
5. CTA Uruchom symulację pozostaje wysoko i jest znacznie bardziej widoczne.
6. Pasek postępu analizy został dodany również do executive summary.
7. Fonty: Montserrat dla nagłówków/liczb + Inter dla tekstu. Oba były już w projekcie, więc nie dodano nowej zależności.
8. get-sports-events przekazuje dodatkowe metadane UI z TEGO SAMEGO response API: leagueLogo, leagueId, leagueFlag, venueName, venueCity, round, season. Nie wykonuje dodatkowego requestu.

LOGIKA
- NIE ZMIENIONA.
- Forecast / xG / 1X2 / O-U / BTTS / calibration / conservative decision są liczone dokładnie jak przed V322.
- Nowe pola API są wyłącznie prezentacyjne.

SQL
- BRAK. V322 nie wymaga migracji Supabase.

WDROŻENIE
- Wgraj cały katalog/ZIP jako kolejną wersję Netlify.
- Jeśli Netlify jest podłączone bezpośrednio do repozytorium, użyj tej paczki jako źródła nowego deployu.
