WERSJA 118 — poprawka daty i kolejności meczów

Baza: wersja 117.

Poprawki:
- dzisiejsza data jest liczona w lokalnej strefie czasowej przeglądarki użytkownika
- frontend dodatkowo filtruje każdy fixture po dokładnej lokalnej dacie kickoffu
- mecze z jutra nie mogą wejść na listę nawet wtedy, gdy API zwróci je w odpowiedzi
- mecze już rozpoczęte są usuwane automatycznie
- kolejność jest wyłącznie od najbliższego kickoffu do najpóźniejszego
- godzina na karcie jest liczona bezpośrednio z commence_time w lokalnej strefie użytkownika
- strefa czasowa przeglądarki jest przekazywana do get-sports-events / API-Football

Uwaga techniczna:
- pełny npm build nie został uruchomiony lokalnie, bo paczka nie zawiera node_modules; plik backendu przeszedł node --check.
