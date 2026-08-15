BETAI WERSJA 1808 — WYKRES SALDA BETFOLIO

Zmiany:
- nowy wygląd wykresu salda inspirowany przesłanym screenem Betfolio,
- wykres wymieniony w zakładkach Mój profil -> Wyniki oraz Statystyki,
- fioletowa, wygładzona linia i delikatne wypełnienie,
- oś czasu pokazuje zaimportowane miesiące oraz późniejsze rozliczone typy,
- saldo kumulacyjne jest liczone od początku historii,
- zmiana zakresu 7D / 30D / 90D / 1R nie zeruje już salda,
- nowe rozliczone typy automatycznie dopisują wynik do końca wykresu,
- pending nie zmienia wykresu do czasu rozliczenia,
- wygrany typ podnosi saldo o stawka × (kurs - 1),
- przegrany typ obniża saldo o stawkę,
- zwrot nie zmienia salda.

Instalacja:
1. Wdróż folder dist na Netlify albo zbuduj projekt poleceniami npm install i npm run build.
2. Nie uruchamiaj żadnego nowego SQL — ta wersja zmienia frontend i logikę wykresu.
