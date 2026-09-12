V369 — FM AI TRACKER HANDSHAKE FIX

Naprawa sytuacji, w której SQL tworzy tabelę poprawnie, ale otwarty wcześniej frontend nadal pokazuje "brak tabeli".
- statystyki są pobierane ponownie przy KAŻDYM otwarciu modala
- 3 krótkie retry dla świeżo utworzonej tabeli / schema cache
- precyzyjny komunikat: brak tabeli / brak ENV / 404 funkcji / błąd Supabase
- SQL wymusza NOTIFY pgrst, 'reload schema'
