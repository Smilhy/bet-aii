WERSJA 1890 — NPM PUBLIC REGISTRY FIX

Naprawa dotyczy wyłącznie instalacji pakietów na Netlify.

Przyczyna:
- package-lock.json z wersji 1889 zawierał 143 odwołań do prywatnego rejestru pakietów środowiska roboczego.
- Netlify nie ma dostępu do tego adresu, więc instalacja mogła zatrzymać się na "Installing npm packages".

Naprawa:
- wszystkie wpisy resolved w package-lock.json wskazują teraz na https://registry.npmjs.org/
- .npmrc wymusza publiczny rejestr npm
- nie zmieniono logiki aplikacji, algorytmu, Supabase ani funkcji Netlify

Wdrożenie:
1. Wgraj pełną paczkę albo podmień package-lock.json, package.json i .npmrc z małej paczki.
2. Zrób commit/push.
3. Netlify: Deploys -> Trigger deploy -> Clear cache and deploy site.
4. Nie używaj pliku package-lock.json z wersji 1889.
