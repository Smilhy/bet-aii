WERSJA 28 — RESPONSIVE CORE

Baza: WERSJA 27 AI PICKS DAILY WATCHDOG FIX.

CEL
Strona ma dopasowywać się automatycznie do szerokości i wysokości ekranu bez ręcznego ustawiania zoomu przeglądarki.

NAJWAŻNIEJSZE ZMIANY
1. Usunięte wymuszanie skali 75% dla monitorów Full HD:
   - usunięty skrypt AUTO 75% z index.html,
   - BetaiExactScaleProvider nie ustawia już zoomu ani transformacji,
   - stare klasy skalowania są automatycznie czyszczone.

2. Dodany osobny plik:
   src/responsive-core-v28.css
   Jest importowany na końcu, dzięki czemu stanowi jeden centralny system responsywny ponad starszymi poprawkami CSS.

3. Nowy układ zależny od dostępnej przestrzeni:
   - duże ekrany: sidebar + treść + prawa kolumna,
   - mniejsze desktopy i Full HD ze skalowaniem Windows: sidebar + szeroka treść, prawa kolumna przeniesiona pod dashboard,
   - laptopy: kompaktowy pionowy sidebar z ikonami,
   - tablet i telefon: poziome przewijane menu oraz jedna kolumna.

4. Dashboard:
   - karty typów zmieniają układ z szerokiej tabeli na czytelne sekcje,
   - kolumny TYP / STAWKA / KURS / ANALIZA nie nachodzą na siebie,
   - prawa kolumna nie znika na mniejszych desktopach — jest przenoszona pod główną treść,
   - filtry mogą być przewijane poziomo zamiast ściskać napisy.

5. Pozostałe podstrony:
   - elastyczne kafelki statystyk,
   - zabezpieczenia min-width: 0 i overflow-wrap,
   - tabele przewijają się we własnym panelu na małych ekranach,
   - dwukolumnowe układy profilu, rankingu, społeczności, portfela i artykułów przechodzą do jednej kolumny na tablecie.

6. Niska wysokość laptopa:
   - zmniejszane są odstępy i wysokości nawigacji,
   - cała aplikacja nie jest sztucznie pomniejszana.

NIE ZMIENIONO
- Supabase i SQL,
- statystyk, rankingu i profili,
- progresji Typer Expert,
- mechanizmu Typów AI,
- rozliczania kuponów,
- logiki płatności i subskrypcji.

TESTY
- npm run build: OK,
- parser CSS: OK, 0 błędów,
- istniejący test progresji Typer Expert: OK (1.00 -> 7.03 i zapis do feedu/Supabase).

NETLIFY
Paczka zachowuje taki sam format projektu jak Wersja 27. Netlify wykona standardowy build. Nie trzeba uruchamiać nowego SQL.
