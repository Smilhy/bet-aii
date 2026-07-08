WERSJA 35 — Mapa świata: prawdziwe flagi + wyrównane ikonki

Zakres zmian:
- Nie zmieniono logiki strony, pobierania danych, Supabase, płatności, typów ani botów.
- Poprawiono tylko warstwę UI zakładki „Mapa świata”.
- Zmieniono wyświetlanie flag z emoji/kodów typu PL/GB na prawdziwe obrazki flag, aby nie pokazywało liter na systemach bez obsługi emoji flag.
- Wyrównano pozycjonowanie pinezek/ikonek na mapie, aby nie uciekały poza krawędzie i lepiej trzymały orbitę.
- Poprawiono flagi w: pinezkach na mapie, liście Top kraje, ostatnich rejestracjach oraz wybranym filtrze kraju.

Sprawdzenie:
- npm run build: OK
- Ostrzeżenia builda dotyczą istniejących duplikatów kluczy i dużego chunka, nie są związane z tą poprawką.
