BETAI — WERSJA 1 MOBILE FIX

Najważniejsze poprawki:
1. Formularz logowania/rejestracji na telefonach 320–430 px nie ma już stałej szerokości 660/700 px.
2. Pola, zakładki i przyciski mieszczą się w ekranie bez ucinania oraz przewijania poziomego.
3. Usunięto wymuszanie viewportu 1600–2600 px i zoomu 50% na tabletach.
4. Najważniejsze kontrolki dotykowe mają co najmniej 44 × 44 px na telefonie i tablecie.
5. Usunięto dwa zduplikowane klucze tłumaczeń i zduplikowane pole rawTip.
6. Poprawiono odwołanie do brakującego obrazu auth-final-455.png.
7. Zmieniono nieaktualny komunikat sugerujący ręczny zoom przeglądarki.
8. Zaktualizowano Supabase i Vite; npm audit nie wykrywa znanych podatności.
9. Numer paczki i aplikacji ustawiono jako Wersja 1 / 1.0.0.

Podstawowe zmienne Netlify:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- PUBLIC_SITE_URL
- APISPORTS_KEY (dla funkcji algorytmu)

Funkcje płatności, OpenAI i automaty administracyjne wymagają również właściwych sekretów, np. STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPENAI_API_KEY, CRON_SECRET lub ADMIN_API_SECRET — zależnie od używanych modułów.

Bezpieczeństwo:
- Nie umieszczaj SUPABASE_SERVICE_ROLE_KEY ani innych sekretów w zmiennych VITE_*.
- Sekrety ustawiaj wyłącznie w Netlify: Site configuration → Environment variables.
- Po wdrożeniu sprawdź logowanie, rejestrację, reset hasła, płatności i zaplanowane funkcje na prawdziwym projekcie Supabase/Netlify.

Szczegóły testów: RAPORT_TESTOW_WERSJA_1.txt
