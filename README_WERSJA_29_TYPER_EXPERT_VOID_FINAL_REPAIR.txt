WERSJA 29 — TYPER EXPERT: OSTATECZNA NAPRAWA BŁĘDNYCH ZWROTÓW

Baza: Wersja 28 Typer Expert PST Void Repair, która była zbudowana na Wersji 27.

Przyczyna, dlaczego poprzednia poprawka nie zmieniła statusu:
- rekord miał już status VOID,
- zapisany stary fixture mógł nadal zwracać PST,
- funkcja zwracała wtedy PENDING, ale nie cofała istniejącego VOID w bazie,
- dodatkowo główny endpoint był jednocześnie funkcją scheduled, więc nie był pewnym endpointem ręcznym.

Zmiany tylko w rozliczaniu Typer Expert:
1. Stary fixture PST jest ponownie dopasowywany po drużynach i dacie; preferowany jest zakończony fixture FT/AET/PEN.
2. Błędny VOID, którego mecz nadal jest PST, zostaje cofnięty do PENDING zamiast pozostać zwrotem.
3. Ostatnie VOID/PUSH Typer Expert są ponownie weryfikowane bez względu na to, w której kolumnie zapisano status.
4. Dodana bezpieczna korekta oficjalnego wyniku Colorado Rapids 1:0 Austin FC:
   - typ Colorado Rapids wygra = WON,
   - stawka 1.00, kurs 1.78 = profit +0.78.
5. settle-typer-expert jest teraz normalnym endpointem HTTP.
6. Cron przeniesiono do osobnej funkcji scheduled-settle-typer-expert.js.

Nie zmieniono:
- interfejsu, CSS, dashboardu, profilu, progresji, rankingu, Typów AI ani struktury Supabase.

Po wdrożeniu:
- automat uruchomi się co godzinę o 37 minucie,
- można uruchomić od razu przez /.netlify/functions/settle-typer-expert
  albo przyciskiem Rozlicz zakończone.

Testy:
- node --check obu funkcji: OK,
- test korekty Colorado Rapids — Austin FC: WON,
- test standardowego 1X2 przy wyniku 1:0: WON.
- pełny npm build nie został uruchomiony, bo wewnętrzne registry nie udostępniło vite 8.1.4; frontend nie był zmieniany.
