WERSJA 26 — TYPER EXPERT: PRAWIDŁOWA STAWKA PROGRESJI OD RAZU

Problem:
- aktywny/pending typ Typer Expert pokazywał na Dashboardzie stawkę 1.00,
- prawdziwa stawka progresji była widoczna dopiero później albo po rozliczeniu,
- historia progresji mogła pomijać stare rekordy zapisane przez username/public_slug/source,
  jeśli author_name nie był dokładnie równy „Typer Expert”.

Naprawa:
1. Historia Typer Expert jest teraz rozpoznawana po wszystkich identyfikatorach:
   author_name, username, public_slug, email i source.
2. get-public-tips przed zwróceniem feedu liczy aktualny stan cyklu progresji.
3. Pierwszy aktywny pending dostaje prawidłową stawkę od razu:
   - poprawiona wartość jest zwracana do Dashboardu i profilu,
   - ta sama wartość jest zapisywana do Supabase w kolumnie stake.
4. Następne publikacje Typer Expert korzystają z pełnej historii, więc nie wracają
   błędnie do 1.00 po kilku stratach.
5. Nie ma twardo wpisanej stawki — system liczy ją z realnej historii i kursu.

Przykład testowy zgodny z pokazanym przypadkiem:
- cykl przed pendingiem: -5.08,
- kurs: 1.78,
- cel cyklu: +0.40,
- prawidłowa następna stawka: 7.03 jednostki.

Test:
- TEST_WERSJA_26_TYPER_EXPERT_PENDING_STAKE.js
- wynik: OK — pending 1.00 -> 7.03 i zapis do Supabase.

SQL:
- nie trzeba uruchamiać żadnego SQL.

Build:
- sprawdzono składnię zmienionych plików Node,
- test logiki progresji przeszedł,
- pełny npm build nie został uruchomiony, ponieważ środowiskowy registry nie posiadał paczki vite 8.1.4.
