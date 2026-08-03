WERSJA 41 — TEAM TOTAL GOALS PRZYWRÓCONE + REALNE KURSY

Naprawa po Wersji 40:
- przywrócono widoczność sekcji Team Total Goals,
- rozszerzono obsługę nazw rynku, m.in. "Home Team - Total Goals",
  "Total Goals - Home Team" i "Goals Over/Under - Home Team",
- nadal odrzucane są rynki 1. połowy, 2. połowy i okresów,
- poprawiono rozpoznawanie gospodarzy/gości także wtedy, gdy strona drużyny
  występuje w wartości kursu, a nie w nazwie rynku,
- dla Team Total preferowany jest realny kurs Bet365, jeżeli API go zwróci;
  w przeciwnym razie używana jest mediana realnych bukmacherów,
- zmieniono wersję cache, aby puste dane z Wersji 40 nie były ponownie używane.

Nie zmieniono innych rynków, kuponów, rozliczeń ani Supabase.
Nie trzeba uruchamiać SQL.
