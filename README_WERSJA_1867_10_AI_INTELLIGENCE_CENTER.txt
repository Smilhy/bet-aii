BETAI WERSJA 1867.10 — AI INTELLIGENCE CENTER / 9 MODUŁÓW W ZAKŁADCE TYPY AI

Wersja została wykonana na bazie 1867.9. Nie zmieniono strategii publikowania botów ani ich blokad:
- BetAI MultiSport AI / Typy AI: brak cooldownu,
- Ograć Buka: brak cooldownu,
- Typer Expert: cooldown 2 godziny i blokada do rozliczenia własnego poprzedniego typu ze względu na progresję.

WDROŻONE MODUŁY

1. RADAR AI
- pokazuje realnych kandydatów sprawdzonych przez aktualny skan,
- wyświetla mecz, ligę, rynek, selekcję, kurs, EV, ocenę AI, liczbę źródeł i status,
- dane trafiają do ekranu bezpośrednio z odpowiedzi skanera oraz z historii ai_pick_runs.

2. TRZY PROFILE REKOMENDACJI
- Bezpieczny: nacisk na stabilność i prawdopodobieństwo,
- Value: najlepsze połączenie kursu, EV i jakości,
- Agresywny: wyższy kurs oraz mniejsza sugerowana stawka.
Są to profile prezentacji i analizy kandydatów. Nie zmieniają strategii publikowania bota.

3. PEŁNA ANALIZA KANDYDATA
- pełne dane spotkania i rynku,
- strategia oraz poziom filtra,
- kurs, prawdopodobieństwo, EV i wynik jakości,
- liczba bukmacherów, rozrzut rynku i status potwierdzenia API,
- lista realnych kursów bukmacherów.

4. HISTORIA KURSU
- wykres zmian kursu,
- pierwszy i ostatni kurs,
- mediana, minimum i maksimum,
- historia jest budowana z kolejnych zapisanych skanów.

5. STATUS ANALIZY
- pobranie meczów,
- pobranie realnych kursów,
- budowanie kandydatów,
- wybór modelu,
- publikacja lub pozostawienie w obserwacji.

6. WYJAŚNIENIE BRAKU TYPU
- liczba sprawdzonych meczów,
- liczba meczów z kursami,
- liczba kandydatów,
- komunikat skanera i błędy API, jeśli wystąpiły.

7. STATYSTYKI WEDŁUG RYNKU
- liczba typów,
- wygrane, przegrane i oczekujące,
- skuteczność,
- średni kurs,
- wynik finansowy dla danego rynku.

8. SUGEROWANA STAWKA
- użytkownik wpisuje własny bankroll,
- system pokazuje sugerowany procent i kwotę na podstawie jakości, EV oraz kursu,
- funkcja jest wyłącznie informacyjna i nie stawia zakładu automatycznie.

9. OBSERWOWANE OKAZJE
- kandydat może zostać dodany gwiazdką do zakładki Obserwowane,
- lista jest zapisywana lokalnie w przeglądarce,
- można otworzyć pełną analizę obserwowanego meczu.

NOWE ZAKŁADKI W TYPY AI
- Typy AI aktywne,
- Radar AI,
- Obserwowane,
- Mecze Result,
- Statystyki.

DANE I SUPABASE
Nie ma nowej migracji SQL dla wersji 1867.10.
Radar działa również bez tabeli diagnostycznej, ponieważ bieżący skan przekazuje dane bezpośrednio do interfejsu i zapisuje ostatni stan w localStorage.

Aby historia kursów była budowana z wielu kolejnych skanów i dostępna po zmianie urządzenia, tabela public.ai_pick_runs musi istnieć. Jeżeli nie była wcześniej utworzona, uruchom raz dołączony plik:
SUPABASE_WERSJA_1867_5_AI_DIAGNOSTYKA.sql

TESTY
- build produkcyjny Vite: OK,
- kontrola składni 41 funkcji Netlify JavaScript: OK,
- paczka zawiera kod źródłowy, funkcje Netlify oraz gotowy katalog dist.

Pozostały wcześniejsze ostrzeżenia projektu o zduplikowanych kluczach tłumaczeń, rawTip, zasobie /auth-final-455.png i dużym bundle. Nie blokują one kompilacji i nie zostały wprowadzone przez wersję 1867.10.
