BetAI WERSJA 51 — Welcome Bonus Registration Fix

Zakres: tylko mechanizm bonusu powitalnego 100 Coin i jego bezpieczne uruchamianie.

Naprawiono:
- 100 Coin jest przyznawane tylko kontu faktycznie utworzonemu w ciągu ostatnich 24 godzin.
- Sama nieobecność rekordu portfela albo welcome_bonus_claimed=false NIE oznacza już nowego konta.
- Przed przyznaniem bonusu sprawdzana jest historia betai_token_transactions.
- Jeśli historia bonusu nie może zostać odczytana, system NIE przyznaje bonusu (fail-safe).
- Zablokowano podwójne uruchomienie mechanizmu powitalnego w tej samej sesji.
- Stare konto, które dostało welcome_bonus później niż 24h po rejestracji przez poprzedni błąd,
  jest samonaprawiane. Prawidłowe saldo jest odtwarzane z portfela, localStorage i historii
  transakcji z pominięciem błędnego bonusu, a korekta jest zapisana jako welcome_bonus_reversal_v51.
- Jeżeli V50 nadpisała wcześniejsze saldo na 100 (np. wcześniej było wyższe), V51 próbuje
  przywrócić rzeczywiste saldo z historii transakcji zamiast ślepo odejmować 100.
- Prawidłowych bonusów otrzymanych podczas rejestracji nie dotyka.
- Stare konto bez portfela nie jest zerowane; saldo jest odtwarzane z dostępnej historii/cache.

Nie zmieniono:
- typów i kursów,
- rozliczeń,
- rankingu,
- algorytmu,
- wyglądu/CSS,
- logiki płatnych typów.

Nie wymaga nowego SQL.
