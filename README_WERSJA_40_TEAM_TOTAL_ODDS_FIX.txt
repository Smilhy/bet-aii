WERSJA 40 — TEAM TOTAL GOALS: POPRAWNE KURSY PEŁNEGO MECZU

Naprawiony problem:
- kursy Team Total Goals pełnego meczu były mieszane z kursami 1. i 2. połowy,
- przez to np. Brann II powyżej 1.5 gola mogło pokazać 2.36 zamiast kursu pełnomeczowego około 1.16.

Zmiany:
1. Backend wpuszcza do Team Total Goals wyłącznie jednoznaczne rynki pełnego meczu.
2. Rynki 1. połowy, 2. połowy, okresów i przedziałów minutowych są odrzucane.
3. Frontend ma dodatkową ochronę przed starym cache z błędnymi rynkami.
4. Zmieniono wersję schematu cache, więc stare błędne kursy nie będą ponownie użyte.
5. Nie zmieniono pozostałych rynków, logiki kuponów, rozliczeń ani Supabase.
6. Nie potrzeba SQL.

Po wdrożeniu odśwież listę meczów / ponownie otwórz mecz, aby pobrać świeże kursy.
