BET+AI WERSJA 131 — STABILNY SNAPSHOT SYMULATORA

CO NAPRAWIONO
- Dane meczu nie powinny już zmieniać się z DOBRE na ODRZUCONE po odświeżeniu/deployu.
- Gdy dany fixture raz uzyska lepszy zestaw danych, backend zapisuje go w Supabase.
- Kolejne wejścia używają zapisanego snapshotu.
- Jeżeli API-Football chwilowo zwróci mniej danych, backend zachowuje lepszy snapshot.
- Jeżeli używany jest przewidywany XI, co ok. 10 minut backend może spróbować ulepszyć go do oficjalnego XI.
- Jeśli odświeżenie jest gorsze, wcześniejsze dane pozostają.

WAŻNE — JEDEN KROK
1. Wejdź w Supabase -> SQL Editor.
2. Uruchom plik: SUPABASE_RUN_ONCE_WERSJA_131_MATCH_SIMULATOR_SNAPSHOTS.sql
3. Deploy paczki v131 na Netlify.

W Netlify powinny już istnieć:
- SUPABASE_URL lub VITE_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Po tym snapshot działa pomiędzy deployami.
