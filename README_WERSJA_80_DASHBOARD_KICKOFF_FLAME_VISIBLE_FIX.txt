WERSJA 80 — widoczny płomień przy statusie Oczekujący

Naprawa V79:
- płomień był elementem span i łapał globalne zielone tło/padding statusu, przez co SVG było niewidoczne/ucięte,
- V80 używa osobnego DIV dla wrappera oraz I dla płomienia,
- płomień jest wyraźnie widoczny już 3–6 h przed meczem,
- im bliżej kickoffu, tym jaśniejszy, większy i szybciej pulsuje,
- po rozpoczęciu meczu płomień znika,
- nie ruszono logiki typów, rankingu, kont ani Supabase.
