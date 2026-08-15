BetAI WERSJA 1824 — 5 JĘZYKÓW / CLONE WERSJI POLSKIEJ

Języki:
- PL — polski
- EN — angielski
- DE — niemiecki
- ES — hiszpański
- RU — rosyjski

Co zostało zrobione:
1. Wybór języka zmienia teksty interfejsu bez przeładowania strony.
2. Wybór jest zapisywany w localStorage i pozostaje po odświeżeniu.
3. Dashboard hero ma osobne wersje graficzne dla EN/DE/ES/RU.
4. Wszystkie bannery podstron Ultra mają osobne wersje dla EN/DE/ES/RU.
5. Panel logowania korzysta z istniejących grafik językowych.
6. Rozszerzono słownik tłumaczeń o statusy, formularze, profile, kupony,
   live chat, mecze, kursy, powiadomienia, Premium i komunikaty błędów.
7. Naprawiono powrót z EN/DE/ES/RU do PL — teksty wracają do języka polskiego.

Nie zmieniono:
- logiki typów i rozliczania,
- Supabase,
- Netlify Functions,
- płatności,
- wyglądu i układu strony,
- danych kont użytkowników.

Nazwy drużyn, lig, użytkowników oraz treści pisane przez użytkowników pozostają
w oryginalnym brzmieniu. Są to dane dynamiczne, a nie tekst interfejsu.

Wdrożenie:
- wgraj folder dist na Netlify albo wdroż cały projekt,
- SQL nie jest potrzebny,
- po wdrożeniu wykonaj Ctrl+Shift+R.

Build: zakończony poprawnie.
