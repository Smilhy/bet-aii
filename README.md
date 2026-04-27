# Bet+AI — wersja 12 FULL FIXED

Poprawiona wersja 12 bazuje na pełnym wyglądzie z wersji 11 i dodaje feed z Supabase.

## Działa:
- pełny layout Bet+AI,
- formularz dodawania typu,
- zapis do Supabase,
- pobieranie typów z Supabase,
- feed “Ostatnie typy” pod formularzem.

## Netlify:
Build command:
npm run build

Publish directory:
dist

## Wersja 13
- filtry feedu: Wszystkie / Darmowe / Premium / AI Typy / Moje
- poprawione karty typów PRO
- statystyki feedu
- hover i badge UI

## Wersja 14 FULL FIXED
Pełna wersja projektu, bez utraty layoutu:
- Dashboard jako osobny widok,
- Dodaj typ jako osobny widok,
- przycisk + Dodaj typ przełącza na formularz,
- po zapisie typu wraca do Dashboardu,
- feed, formularz, Supabase, filtry, sidebar i prawa kolumna zostają.

## Wersja 15 FULL
Dodano PRO UX:
- toast po dodaniu typu i przy błędach,
- skeleton loader podczas pobierania feedu,
- lepszy empty state,
- blokada przycisku podczas zapisu została zachowana,
- pełny layout i wszystkie funkcje z v14 zostają.

## Wersja 16 FULL
Dodano system monetyzacji premium:
- premium typy są zablokowane,
- ukryty typ, kurs, AI% i analiza,
- przycisk “Odblokuj za X zł”,
- po kliknięciu karta pokazuje pełną treść,
- toast potwierdzający odblokowanie,
- panel Marketplace premium nad feedem.

To jest symulacja zakupu pod przyszłe podpięcie Stripe.

## Wersja 17 FULL
Dodano portfel użytkownika:
- saldo konta w sidebarze i topbarze,
- widok Portfel,
- lista odblokowanych typów,
- licznik zakupów,
- symulacja doładowania +100 zł,
- odblokowanie premium odejmuje środki,
- brak środków pokazuje toast.


## Wersja 18 FULL
Dodano profil tipstera (UI przygotowane pod statystyki i sprzedaż).

## Wersja 19 FULL
Dodano ranking tipsterów:
- zakładka Ranking w sidebarze,
- leaderboard z ROI, winrate, profit, typami i premium,
- statystyki top marketplace,
- CTA “Zostań tipsterem PRO”.

## Wersja 20 FULL
Dodano Supabase Auth:
- ekran logowania i rejestracji,
- sesja użytkownika,
- wylogowanie,
- email użytkownika w topbarze i sidebarze,
- admin badge dla smilhytv@gmail.com,
- tips dostają author_id i author_name z zalogowanego konta,
- nowy schema.sql z profiles i unlocked_tips.

WAŻNE: w Supabase → Authentication możesz wyłączyć email confirmation na czas testów,
żeby rejestracja działała natychmiast.

## Wersja 21 FULL FIXED
Poprawiony krok 21:
- build przechodzi bez błędu JSX,
- modal płatności premium,
- symulacja Stripe Checkout,
- po zapłacie typ zostaje odblokowany,
- layout z wersji 20 zostaje zachowany.


## Wersja 22 FULL
Przygotowanie pod Stripe Checkout: struktura pod realne płatności bez psucia aktualnej aplikacji.

## Wersja 23 FULL — Stripe Checkout

Dodano prawdziwy fundament Stripe:
- Netlify Function: `netlify/functions/create-checkout-session.js`
- przycisk “Zapłać przez Stripe”
- fallback “Odblokuj testowo”
- obsługa powrotu `payment=success`
- ENV: `STRIPE_SECRET_KEY`

### Co trzeba dodać w Netlify
Environment variables:
- `STRIPE_SECRET_KEY` = Twój Stripe secret key, np. `sk_test_...`

Po dodaniu ENV:
Deploys → Trigger deploy → Deploy without cache

Jeśli nie dodasz STRIPE_SECRET_KEY, aplikacja nadal działa dzięki przyciskowi “Odblokuj testowo”.


## Wersja 24
Dodano Stripe Webhook (backend ready pod realne odblokowanie po płatności)

## STRIPE FIX
Poprawka błędu: `payment method type: blik is invalid`.
Stripe Checkout używa teraz tylko `card`, więc działa bez aktywowania BLIK/P24 w Stripe Dashboard.
Webhook poprawiony: `received: true`.

## Wersja 25 FULL — płatności zapis do bazy

Dodano:
- historia płatności w aplikacji,
- zakładka “Płatności”,
- tabela `payments` w Supabase,
- webhook zapisuje `unlocked_tips` i `payments`,
- checkout przekazuje `user_id`, `tip_id`, kwotę,
- Stripe nadal używa tylko `card`, bez BLIK/P24.

### Ważne ENV w Netlify
Wymagane:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Dla zapisu webhooka do Supabase dodaj też:
- `SUPABASE_SERVICE_ROLE_KEY`

Klucz service role znajdziesz w Supabase:
Project Settings → API → service_role key.
Nie wklejaj go publicznie.
