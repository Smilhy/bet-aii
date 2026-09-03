BET+AI WERSJA 126 — STRICT DATA GATE + PREDICTED XI

Zmiany względem v125:
1. Lista Symulatora AI pokazuje tylko dzisiejsze nierozpoczęte mecze z realnymi kursami 1X2.
2. Przed symulacją działa twardy filtr jakości danych.
3. Wymagane do uruchomienia: min. 5 ostatnich meczów obu drużyn, min. 2 H2H, sprawdzone absencje, XI obu drużyn z pozycjami, tabela obu drużyn, statystyki sezonowe obu drużyn, prognoza API i realne kursy 1X2.
4. Jeżeli oficjalne XI nie są jeszcze dostępne, backend pobiera ostatnie realne oficjalne składy i tworzy przewidywane XI.
5. Przewidywane XI jest oznaczone jako PRED XI / Przewidywane XI i ma confidence %. Nie jest przedstawiane jako skład oficjalny.
6. Przy budowaniu przewidywanego XI uwzględniana jest częstotliwość startów, aktualna pozycja w ostatnich składach, recency oraz bieżące absencje.
7. Jeśli danych nie wystarcza, mecz jest odrzucony i przycisk Uruchom symulację pozostaje zablokowany.
8. Match Engine również posiada backendowy hard-gate i nie uruchomi meczu niespełniającego warunków, nawet przy wejściu z pominięciem ekranu przygotowania.

UWAGA: Przewidywane XI i wynik symulacji pozostają prognozą probabilistyczną. Nie są gwarancją przyszłego składu ani wyniku.
