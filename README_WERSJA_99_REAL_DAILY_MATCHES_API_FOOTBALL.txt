WERSJA 99 — REAL DAILY MATCHES

Naprawiono najważniejszy problem wersji 98:
- usunięto wszystkie ręcznie wpisane / fake mecze
- lista „Mecze dnia” pobiera dane z istniejącego Netlify get-sports-events
- tylko tryb all-today, tylko aktualny dzień w Europe/Warsaw
- tylko rekordy z prawdziwym apiFixtureId
- realOnly=1 + forceRefresh=1
- nie ma fallbacku demo na ekranie Mecze dnia
- sortowanie preferuje topowe ligi, ale każdy wyświetlony fixture pochodzi z API
- pokazuje prawdziwe loga drużyn z API
- kursy 1X2 są pokazywane WYŁĄCZNIE gdy fixture ma hasRealOdds=true
- kliknięcie Symuluj przekazuje dokładny apiFixtureId do Match Engine

Jeżeli API nie zwróci danych, UI pokazuje błąd/pustą listę zamiast wymyślać mecze.
