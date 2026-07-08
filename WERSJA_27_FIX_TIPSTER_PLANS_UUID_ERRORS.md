# WERSJA 27 — fix błędów 400 tipster_plans dla botów

Problem:
- Front próbował pobrać `tipster_plans` dla botów/pseudo-profili z ID typu `user:typer expert`.
- Kolumna `tipster_plans.tipster_id` w Supabase jest typu UUID.
- Supabase zwracał 400: `invalid input syntax for type uuid: "user:typer expert"`.

Poprawka:
- Dodano walidację UUID przed zapytaniami do `tipster_plans`.
- Dla botów i aliasów nienależących do prawdziwego UUID zapytanie do `tipster_plans` jest pomijane.
- Lokalny cache planów nadal działa.
- Dodano też walidację UUID w funkcji checkout subskrypcji profilu, żeby przypadkowy pseudo-id nie szedł do zapytań Supabase.

Nie zmieniono:
- wyglądu,
- płatności dla prawdziwych profili,
- botów,
- rozliczeń,
- Supabase schema,
- logiki typów.
