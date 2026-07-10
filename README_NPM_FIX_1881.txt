NAPRAWA NPM / NETLIFY — WERSJA 1881

Przyczyna:
W poprzedniej paczce znalazl sie package-lock.json wygenerowany w srodowisku roboczym.
Zawieral adresy prywatnego rejestru pakietow, do ktorego Netlify nie ma dostepu.
To moglo zatrzymac instalacje npm.

Naprawa:
1. Usun package-lock.json z repozytorium GitHub (jesli zostal wgrany).
2. Wgraj pliki z tej paczki.
3. W Netlify wybierz: Retry deploy -> Clear cache and deploy site.
4. Nie zmieniaj package.json — w tej paczce jest oryginalny plik projektu.

Kod zakladki Algorytm pozostaje bez zmian.
