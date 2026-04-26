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
