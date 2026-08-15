# WERSJA 30 — Mapa świata zarejestrowanych

Dodano nową zakładkę `Mapa świata` w lewym menu dashboardu.

Co robi:
- czyta użytkowników z tabeli `profiles`,
- pokazuje flagę kraju i nick użytkownika na mapie/drzewku,
- pokazuje liczbę użytkowników i krajów,
- pokazuje listę krajów oraz ostatnie rejestracje,
- działa bez ciężkiej biblioteki mapy, więc nie powinna dodatkowo mulić strony.

Dodatkowo dodano funkcję Netlify `record-profile-country`, która może zapisać kraj wykryty z przeglądarki użytkownika.

Aby kraj zapisywał się w Supabase dla nowych użytkowników, uruchom raz:
`SUPABASE_RUN_ONCE_WERSJA_30_WORLD_REGISTERED_MAP.sql`
