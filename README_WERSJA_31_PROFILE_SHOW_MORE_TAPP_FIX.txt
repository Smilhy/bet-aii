WERSJA 31 — NAPRAWA „POKAŻ KOLEJNE TYPY” W MOIM PROFILU

Błąd:
Po kliknięciu „Pokaż kolejne 3 typy” aplikacja renderowała przycisk „Zwiń do 3 typów”,
ale używała w tym miejscu funkcji tApp, której nie było w zakresie komponentu profilu.
Powodowało to błąd: „tApp is not defined”.

Naprawa:
- dwa błędne wywołania tApp w sekcji typów profilu zostały zastąpione właściwą funkcją t,
- działa dla zwykłych typów oraz kupionych singli,
- nie zmieniono żadnej innej logiki, CSS, Supabase, Netlify Functions, statystyk ani rozliczeń.
