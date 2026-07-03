WERSJA 20 — FIX OPERA POWRÓT Z KARTY AUTO RELOAD

Problem: po przejściu na inne karty i powrocie Opera/Chromium czasem zostawiała czarną warstwę renderującą, mimo że DOM aplikacji nadal istniał.
Zmiana: po dłuższym pobycie karty w tle aplikacja wykonuje jedno świeże uruchomienie po powrocie, zachowując aktualny adres/zakładkę.
Nie zmieniano logiki typów, płatności, Supabase ani funkcji Netlify.
