WERSJA 42 — TEAM TOTAL GOALS W WYSZUKIWARCE MECZU

Przyczyna:
- wyszukiwanie konkretnego meczu pobierało tylko pierwszą stronę endpointu /odds,
- API może rozdzielić bukmacherów i rynki na kilka stron,
- Team Total Goals mógł znajdować się na kolejnej stronie i dlatego cała sekcja znikała.

Naprawa:
- pobierane są wszystkie dostępne strony kursów dla konkretnego fixture,
- wyniki wszystkich stron są łączone przed mapowaniem rynków,
- nadal odrzucane są rynki Team Total z 1. i 2. połowy,
- zmieniono wersję cache, aby stare dane bez Team Total nie były używane.

Nie zmieniono innych rynków, kuponów, rozliczeń ani Supabase.
Nie trzeba uruchamiać SQL.
