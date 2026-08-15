# BetAI wersja 14 — AI Prediction: wyniki i pełna historia

## Naprawiony problem statystyk

W wersji 13 zapis predykcji do `ai_prediction_history` następował wyłącznie podczas wywołania funkcji `get-ai-predictions`, czyli najczęściej po wejściu użytkownika do zakładki. Sam scheduler rozliczający potrafił rozliczyć tylko rekordy, które wcześniej istniały w tabeli. Jeżeli strona nie była otwarta przed meczem, predykcja nie trafiała do historii i później nie mogła wejść do statystyk.

Wersja 14 dodaje osobną zaplanowaną funkcję `capture-ai-predictions`, która co 2 godziny zapisuje przedmeczowe snapshoty niezależnie od otwierania strony. Rozliczanie działa nadal co godzinę.

## Nowa zakładka

W AI Prediction są teraz dwa widoki:

- Aktualne predykcje
- Rozliczone mecze i wyniki

Drugi widok pokazuje pełny rejestr zapisanych predykcji: mecz, datę, wybór AI, confidence, kurs, wynik 90 minut, status i zysk jednostkowy. Dostępne są filtry: wszystkie, rozliczone, wygrane, przegrane, zwroty i oczekujące. Historia jest pobierana stronami po 100 rekordów.

## Ważne

Nie jest wymagany nowy SQL, jeżeli tabela `ai_prediction_history` z wersji 13 już istnieje. System pokaże wszystkie rekordy faktycznie zapisane w tej tabeli. Predykcji, które przed wersją 14 nie zostały zapisane przed rozpoczęciem meczu, nie można uczciwie odtworzyć po fakcie.
