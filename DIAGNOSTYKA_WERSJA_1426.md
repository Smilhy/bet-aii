# DIAGNOSTYKA WERSJA 1426

## Wynik audytu

- Build produkcyjny został uruchomiony lokalnie. Nie ma błędów kompilacji; są tylko stare ostrzeżenia o duplikatach kluczy tłumaczeń i dużych chunkach.

- Najcięższy realny problem z 1425 był w DM/kopercie i został ograniczony.

- W 1426 dodałem drugi poziom optymalizacji: cache profili publicznych, limity 250 zamiast 1000 i timeouty na katalog profili.


## Co było ryzykowne w 1425

- `fetchBetaiPublicProfiles()` mogło być wywoływane z kilku miejsc i za każdym razem próbowało pobrać pełny katalog profili.

- `fetchBetaiProfilesWithStats()` oraz fallbacki miały `limit(1000)`. Przy wolniejszym Supabase to powodowało opóźnienia.

- Paczka miała poprawiony source, ale dla pewności w 1426 przebudowałem `dist`, żeby Netlify/static deploy nie użył starego buildu.


## Poprawki w 1426

- Cache profili publicznych na 60 sekund.

- Jedno równoległe żądanie profili naraz; kolejne czeka na tę samą obietnicę zamiast robić nowe zapytanie.

- Timeout 4.5s dla katalogu profili.

- Limity profili 1000 -> 250.

- Zachowane optymalizacje DM z 1425.

- Rebuild `dist` wykonany po zmianach.
