BET+AI — WERSJA 1802 ENGLISH COMPLETE
======================================

CEL PACZKI
----------
Ta paczka dodaje pełną obsługę angielskiej wersji interfejsu bez nadpisywania
ani podmieniania polskiej wersji strony.

ZASADA DZIAŁANIA
----------------
1. Po wybraniu języka „English” interfejs, formularze, komunikaty, placeholdery,
   etykiety dostępności oraz teksty generowane dynamicznie są wyświetlane po angielsku.
2. Po wybraniu „Polski” przywracane są oryginalne polskie teksty.
3. Wybrany język jest zapisywany w localStorage pod kluczem „betai_language”.
4. Ustawienie języka działa przed logowaniem, w resetowaniu hasła i po zalogowaniu.
5. Polska wersja grafik i kodu źródłowego nie została zastąpiona.

GRAFIKI ANGIELSKIE
------------------
Angielskie odpowiedniki głównych bannerów znajdują się w:

public/localized/en/

Obejmują między innymi:
- ekran i slajdy dashboardu,
- bannery profilu, portfela, rankingu, artykułów i powiadomień,
- bannery płatności, subskrypcji, zarobków i wypłat,
- bannery paneli administracyjnych,
- główne bannery sekcji Typy AI.

Po zmianie języka na angielski aplikacja automatycznie wybiera pliki z tego katalogu.
Oryginalne polskie pliki w public/ pozostały bez zmian.

NAJWAŻNIEJSZE ZMIANY W KODZIE
-----------------------------
- src/i18nEnglish.js
  Centralna warstwa tłumaczeń angielskich, również dla tekstów dynamicznych.

- src/main.jsx
  Obsługa przełączania języka, tłumaczenie atrybutów i tekstów dynamicznych,
  zachowanie wartości wpisywanych przez użytkownika, podmiana grafik EN,
  angielski ekran logowania i resetowania hasła.

- src/styles.css
  Warunkowe użycie angielskiego bannera rankingu przy aktywnym języku EN.

URUCHOMIENIE LOKALNE
--------------------
1. Otwórz terminal w katalogu projektu.
2. Zainstaluj zależności:

   npm install

3. Uruchom wersję developerską:

   npm run dev

BUILD PRODUKCYJNY
-----------------
Build został wykonany poprawnie. Gotowe pliki produkcyjne są w katalogu:

dist/

Aby wykonać build ponownie:

   npm run build

WDROŻENIE
---------
Można wdrożyć projekt źródłowy zgodnie z dotychczasową konfiguracją Netlify
albo opublikować zawartość katalogu dist/ jako statyczny build aplikacji.

UWAGA DOTYCZĄCA GRAFIK
----------------------
Główne widoczne tytuły, opisy, przyciski i sekcje bannerów zostały przygotowane
po angielsku. Niektóre bardzo małe napisy wewnątrz rastrowych miniaturek/mockupów
interfejsu są częścią oryginalnego obrazu. Ich pełna zamiana wymagałaby całkowitego
przerysowania każdej miniaturowej makiety od zera.

WERYFIKACJA
-----------
- npm run build: zakończony powodzeniem,
- polskie pliki graficzne: bez zmian,
- angielskie grafiki: dodane jako osobny zestaw,
- przełączanie PL/EN: zapamiętywane i obsługiwane przed oraz po zalogowaniu.
