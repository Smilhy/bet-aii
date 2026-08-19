BetAI WERSJA 78 — prawa kolumna: Typer Expert / Ograć Buka

Znaleziony błąd V77:
- profil systemowy miał techniczne ID np. lookup:typer-expert,
- rekordy tips często nie mają author_id/user_id,
- generyczny ranking tworzył drugi wpis tej samej osoby z innym kluczem,
- prawa kolumna potrafiła wybrać duplikat policzony tylko z 1 kuponu,
  stąd 100.00% / 71.00% i 1 kupon mimo poprawnych profili 47/32.

V78:
- jeden stały klucz: system:typer-expert,
- jeden stały klucz: system:ograc-buka,
- wszystkie aliasy tych botów scalane są do tych kluczy,
- po normalnym merge usuwane są wszystkie duplikaty obu botów,
- prawa kolumna dostaje jeden kanoniczny wiersz policzony bezpośrednio z pełnej historii,
- statystyki mają odpowiadać profilom botów,
- nie ruszono statystyk zwykłych użytkowników, Algorytmu, Coinów ani mechaniki typowania.

Diagnostyka:
https://bet-ai.app/.netlify/functions/check-rightbar-bot-stats-v78
