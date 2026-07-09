WERSJA 39 — Mapa świata: stabilne flagi po kliknięciu

Zakres zmian:
- poprawiono drganie/przesuwanie flagi po kliknięciu kraju,
- pozycje pinezek są teraz stabilne i nie przeliczają się wizualnie przy wyborze kraju,
- aktywny/hover efekt został bez skalowania elementu, więc flaga nie skacze w prawo/lewo,
- animacja wejścia pinezki nie nadpisuje już transformacji pozycji,
- zmiana tylko UI/CSS + pozycjonowanie pinezek mapy; logika strony i pobieranie danych bez zmian.

Sprawdzenie:
- npm run build: OK
- build zakończony poprawnie, tylko istniejące ostrzeżenia Vite o duplikatach kluczy i dużym chunku.
