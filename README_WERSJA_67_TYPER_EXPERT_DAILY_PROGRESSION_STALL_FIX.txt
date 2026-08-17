BetAI WERSJA 67 — Typer Expert: naprawa 15-dniowego zastoju i progresji

Znalezione problemy:
1. Stan progresji Typer Expert był liczony z `.limit(1500)` całej tabeli `tips`
   posortowanej od najstarszych rekordów.
2. Settlement Typer Expert sprawdzał tylko `.limit(700)` najnowszych rekordów
   całej tabeli `tips`.
3. Przy dużej liczbie typów innych użytkowników te dwa okna mogły nie obejmować
   tego samego rekordu Typer Expert. Stary pending mógł więc blokować progresję,
   ale rozliczanie go nie widziało.
4. Publiczny feed potrafił naprawiać stawkę Typer Expert tylko na podstawie
   ostatnich 300/500 rekordów i przez brak wcześniejszych strat mógł wyliczyć
   złą stawkę (np. wrócić do 1.00).
5. Przełożony mecz PST mógł blokować progresję bezterminowo.
6. Typer Expert mógł wybrać mecz kilka dni do przodu, a ponieważ czeka na wynik
   poprzedniego typu, utrudniało to spełnienie minimum 1 typu dziennie.

V67:
- historia progresji jest pobierana wyłącznie po tożsamości Typer Expert,
  niezależnie od typów innych użytkowników,
- settlement jest pobierany wyłącznie dla Typer Expert,
- publish-typer-expert przed każdym skanem sam uruchamia settlement,
- publiczny feed używa tego samego kanonicznego kalkulatora progresji,
- PST starszy niż 24 h jest dla WIRTUALNEJ progresji traktowany jako void/zwrot,
  aby nie blokował bota bez końca,
- Typer Expert wybiera mecze maksymalnie 24 h do przodu,
- po przegranej kolejna stawka nadal pokrywa stratę i cel +0.40 jednostki,
- limit stawki pozostaje 1000,
- nadal maksymalnie 1 typ na pojedynczy cykl publikacji,
- cron pozostaje: publikacja co 2 h, settlement co godzinę, watchdog co godzinę.

Po wdrożeniu uruchom RAZ:
https://bet-ai.app/.netlify/functions/repair-typer-expert-stall-v67

Kontrola bez zmian danych:
https://bet-ai.app/.netlify/functions/check-typer-expert-v67

Nie zmieniono:
- Algorytmu Over/Under,
- Dashboardu,
- profili innych typerów,
- Ograć Buka,
- BetAI MultiSport AI,
- kursów użytkowników,
- rozliczania zwykłych typów,
- CSS/UI.

SQL nie jest potrzebny.
