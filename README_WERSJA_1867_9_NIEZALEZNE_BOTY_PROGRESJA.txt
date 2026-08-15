BETAI WERSJA 1867.9 — NIEZALEŻNE BOTY + TYLKO TYPER EXPERT Z BLOKADĄ PROGRESJI

Poprawka została wykonana na bazie wersji 1867.8 bez zmian wyglądu i pozostałej logiki strony.

ZASADY PO POPRAWCE

1. BetAI MultiSport AI / Typy AI
- działa niezależnie od pozostałych botów,
- nie ma cooldownu,
- nie jest blokowany przez aktywny typ,
- przy każdym swoim skanie może dodać jeden nowy realny typ,
- nie publikuje drugi raz tego samego fixture dla własnego profilu.

2. Ograć Buka
- działa niezależnie od pozostałych botów,
- nie ma cooldownu,
- nie jest blokowany przez aktywny typ,
- zachowuje własną strategię i stałą stawkę 1,
- nie publikuje drugi raz tego samego fixture dla własnego profilu.

3. Typer Expert
- działa niezależnie od pozostałych botów,
- jako jedyny ma cooldown 2 godziny między własnymi typami,
- jako jedyny czeka na rozliczenie własnego poprzedniego typu,
- blokada nie zależy od BetAI AI ani Ograć Buka,
- po rozliczeniu wylicza następną stawkę progresji,
- po stracie dopasowuje stawkę do kursu następnego meczu,
- po zamknięciu cyklu na plus wraca do bazowej stawki,
- progresja: stawka bazowa 1, cel cyklu 0.4, limit 1000.

HARMONOGRAMY SĄ NIEZALEŻNE
- BetAI MultiSport AI: 7. minuta co 2 godziny,
- Typer Expert: 27. minuta co 2 godziny,
- Ograć Buka: 47. minuta co 2 godziny.

Harmonogram oznacza częstotliwość skanowania, a nie cooldown.
Każdy bot uruchamia własną funkcję i nie czeka na pozostałe boty.

NIE ZMIENIONO
- wyglądu strony,
- logowania i rejestracji,
- płatności,
- Supabase,
- strategii wyboru rynków każdego bota,
- zakresu kursów 1.50–5.00,
- automatycznego rozliczania.

SQL nie jest potrzebny.

DOPRECYZOWANIE COOLDOWNU
- BetAI MultiSport AI / Typy AI: 0 godzin.
- Ograć Buka: 0 godzin.
- Typer Expert (progresja): dokładnie 2 godziny.
- Cooldown jednego bota nie blokuje żadnego innego bota.
