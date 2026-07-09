WERSJA V40 — Dashboard hero: pilne komunikaty sportowe

Zakres:
- Dashboard hero pokazuje teraz dodatkowe slajdy z pilnymi komunikatami sportowymi.
- W wersji PL źródłem jest Sport.pl przez istniejącą funkcję Netlify sportpl-articles.
- W wersji EN/UK źródłem jest BBC Sport RSS przez tę samą funkcję Netlify z parametrem source=bbc.
- Komunikat jest dopasowany do rozmiaru baneru hero: tytuł ma clamp/line-clamp, opis jest ucinany bez psucia layoutu.
- Slajd jest klikalny i otwiera pełny artykuł w nowej karcie.
- Auto-odświeżanie newsów: co 10 minut.
- Nie zmieniano logiki strony, typów, kont, rankingu, profili ani mapy świata.

Pliki zmienione:
- src/main.jsx
- src/styles.css
- netlify/functions/sportpl-articles.js
