BETAI WERSJA 1842 — TYPER EXPERT: RÓWNE GODZINY

Zmiana dotyczy wyłącznie harmonogramu funkcji publish-typer-expert.

Poprzednio:
23 */3 * * *

Teraz:
0 */3 * * *

Typer Expert uruchamia skanowanie codziennie o:
00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00 i 21:00 UTC.

Netlify Scheduled Functions używają czasu UTC.
Silnik nadal nie publikuje typu na siłę: jeżeli nie znajdzie kandydata spełniającego filtry albo istnieje nierozliczony typ, nie doda nowego.

Nie zmieniono:
- strategii wyboru meczów,
- researchu internetowego,
- analizy do 500 znaków,
- progresji stawek,
- limitu 1000,
- profilu ani wyglądu strony.

Wdrożenie:
1. Wgraj projekt jako Production deploy w Netlify.
2. Sprawdź w Netlify > Functions, czy publish-typer-expert ma status Scheduled.
3. SQL nie jest potrzebny.
