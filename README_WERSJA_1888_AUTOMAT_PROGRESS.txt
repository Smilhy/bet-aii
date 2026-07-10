WERSJA 1888 — PASEK POSTĘPU AUTOMATU

Dodano do zakładki „Algorytm”:
- pasek postępu sprawdzania meczów pre-match,
- licznik „Sprawdzono X/Y” i procent postępu,
- liczbę gotowych typów,
- liczbę meczów oczekujących w kolejce,
- liczbę meczów zakończonych bez wymaganych danych,
- status workera: PRACUJE / OCZEKUJE NA CYKL / KOLEJKA SPRAWDZONA,
- licznik do następnego automatycznego skanu co 15 minut,
- odświeżanie danych postępu co 15 sekund.

Pasek liczy jako sprawdzone zarówno mecze z gotowym wynikiem analizy, jak i mecze,
dla których pełne sprawdzenie wykazało brak danych. Dzięki temu 100% oznacza, że cała
aktualna kolejka pre-match została sprawdzona, a nie że każdy mecz otrzymał typ.

WDROŻENIE:
1. Wgraj pełną paczkę do repozytorium albo podmień pliki z paczki „tylko zmienione”.
2. Netlify: Clear cache and deploy site.
3. Nowy SQL nie jest potrzebny — wersja korzysta z tabel utworzonych w V1886.

Zmienione pliki:
- src/AlgorithmView.jsx
- src/styles.css
- netlify/functions/get-algorithm-picks.js
- package.json (numer wersji)

Weryfikacja:
- npm run test:algorithm — OK
- npm run build — OK
  (pozostały wcześniejsze ostrzeżenia projektu o duplikatach kluczy w src/main.jsx;
   nie są związane z paskiem postępu i nie zatrzymują kompilacji)
