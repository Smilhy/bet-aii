# BetAI — wersja 8: naprawa błędu AI Settlement

## Przyczyna

Wersja 7 rozszerzyła rozpoznawanie źródła `betai_independent_value_v1867_9`, ale zwykłe rozliczenie wybierało również wszystkie historyczne rekordy WON/LOST bez zapisanych pól live_score. Przy większej historii funkcja wykonywała bardzo dużo kolejnych zapytań do API-Sports i mogła przekroczyć limit czasu Netlify. Frontend dostawał wtedy odpowiedź gateway/HTML zamiast JSON i pokazywał ogólny komunikat „Nie udało się rozliczyć zakończonych meczów”.

## Zmiany

- zwykłe rozliczenie bierze tylko PENDING/LIVE i podejrzane błędne VOID,
- dzisiejsze/najnowsze rekordy są pobierane jako pierwsze,
- przetwarzanie działa partiami, domyślnie do 16 rekordów,
- funkcja kończy partię przed limitem czasu Netlify,
- pojedyncze zapytanie API ma timeout 8 sekund,
- wyniki tego samego fixture są cache’owane w ramach uruchomienia,
- skan tabeli `tips` jest ograniczony do najnowszych rekordów,
- frontend pokazuje rzeczywisty błąd HTTP/Netlify zamiast pustego komunikatu.

## Wdrożenie

Użyj Git deploy albo skryptu `DEPLOY_NETLIFY_WINDOWS.bat` / `DEPLOY_NETLIFY_MAC_LINUX.sh`. Samo przeciągnięcie folderu `dist` publikuje frontend, ale nie buduje i nie wdraża funkcji Netlify.
