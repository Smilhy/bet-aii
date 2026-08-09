BET+AI WERSJA 52 — MANUAL TIP STATE FIX

Naprawione:
1. Tryb AUTO nie może już nadpisywać formularza ręcznego po kliknięciu "Dodaj zakład".
   To był bezpośredni powód zmiany ręcznego typu na domyślny "Manchester City wygra".
2. Ręczny publish omija resolver rynków AUTO i zapisuje dokładnie market / typ / kurs z formularza ręcznego.
3. Wszystkie warianty payloadu do Supabase zapisują prediction dla typu ręcznego.
4. Dashboard natychmiast dostaje poprawny snapshot ręcznie opublikowanego typu, nawet jeśli odpowiedź DB ma stare pole prediction.
5. Parser wydarzenia rozpoznaje format "Team A v Team B" — nie tworzy już sztucznego "Rywale".
6. Normalize manual tips preferuje jawny bet_type nad starym/defaultowym prediction.

Jednorazowa korekta istniejącego błędnego typu smilytv:
/.netlify/functions/repair-smilytv-slavia-manual-v52

Korekta ustawia:
SK Slavia Praha vs FK Pardubice
Rynek: Wynik 1. połowy
Typ: SK Slavia Praha wygra 1. połowę
Kurs: 1.57
Status: Oczekujący

Nie zmieniono logiki typów automatycznych, rozliczeń, algorytmu ani innych rynków.
