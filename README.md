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

## Wersja 26 FULL — panel zarobków tipstera
Dodano:
- zakładka `Zarobki`,
- przychód brutto,
- prowizja platformy 15%,
- kwota do wypłaty,
- sprzedaże i konwersja,
- tabela najpopularniejszych typów premium,
- schema pod `payout_requests`.

Po wrzuceniu tej wersji możesz opcjonalnie odpalić `supabase/schema.sql`, aby dodać tabelę payoutów.

## Wersja 27 FULL — webhook zapisuje sprzedaż do bazy

Zrobione:
- `netlify/functions/stripe-webhook.js` zapisuje płatność do `payments`,
- webhook odblokowuje typ w `unlocked_tips`,
- `create-checkout-session.js` przekazuje metadata: `user_id`, `tip_id`, `amount_pln`,
- Stripe używa tylko karty (`card`), bez BLIK/P24.

Wymagane ENV w Netlify:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

W Supabase odpal `supabase/schema.sql`, jeśli tabela `payments` jeszcze nie istnieje.

## Wersja 28 — FIX trwałego odblokowania
Poprawka problemu: po odświeżeniu odblokowany typ znikał.
Zrobione:
- aplikacja pobiera `unlocked_tips` z Supabase po zalogowaniu,
- po powrocie ze Stripe `payment=success` zapisuje odblokowanie do Supabase,
- demo unlock też zapisuje odblokowanie,
- dodane polityki RLS dla `unlocked_tips`.

Po wrzuceniu paczki:
1. GitHub → wrzuć wszystkie pliki.
2. Netlify → Deploy WITHOUT cache.
3. Supabase SQL → odpal `supabase/schema.sql`, jeśli tabela `unlocked_tips` nie istnieje lub zapis nadal nie działa.

## Wersja 29 — FIX odblokowania po odświeżeniu
Poprawiono problem: po zakupie typ był odblokowany tylko do odświeżenia.
Teraz:
- odblokowane typy zapisują się lokalnie w przeglądarce,
- aplikacja od razu odczytuje lokalny zapis po refreshu,
- dodatkowo próbuje zapisać `unlocked_tips` w Supabase,
- pobieranie z Supabase nie kasuje lokalnych odblokowań.

## Wersja 30 — blank screen fix
Naprawiono biały ekran po zakupie:
- poprawiono `updateUnlockedTips`, który w wersji 29 wywoływał sam siebie,
- nadal zachowuje odblokowanie lokalnie po refreshu,
- po powrocie ze Stripe URL jest czyszczony bez zapętlenia.

## Wersja 31 — NETLIFY BUILD FIX
Poprawka sytuacji, gdy Netlify stoi na `Installing npm packages`:
- usunięto `package-lock.json`,
- uproszczono `package.json`,
- przypięto stabilne wersje paczek,
- netlify.toml wykonuje szybki install bez audit/fund,
- paczka ma tylko niezbędne pliki do GitHub upload.

## Wersja 32 — payments final fix
- Dodanie typu nie powinno oznaczać zakupu.
- Zakup uznawany jest tylko po powrocie ze Stripe z `stripe=1`.
- Webhook zapisuje `unlocked_tips` oraz `payments`.
- Dodany fallback zapisu `payments` z frontendu po powrocie ze Stripe.
- Odpal `supabase/schema.sql`, potem deploy bez cache.

## Wersja 33 — fix unlock per user
Poprawiono problem:
- po wylogowaniu odblokowania nie mieszają się między kontami,
- zakup odblokowuje tylko jeden konkretny typ,
- localStorage jest teraz per-user,
- po logout aplikacja czyści widok odblokowań,
- bez logowania nie można kupić premium, żeby zakup nie zapisał się jako guest.

## Wersja 34 — payment return/session fix
Poprawka sytuacji:
- po przejściu do Stripe i powrocie aplikacja traciła kontekst zakupu,
- teraz przed przekierowaniem zapisuje `pending purchase`,
- po powrocie ze Stripe odblokowuje konkretny typ nawet jeśli URL nie przyniesie kompletu danych,
- zapisuje też `payments` jako fallback z frontendu,
- dodane polityki RLS dla fallbacku.

## Wersja 35 — fix: dodanie typu nie zwiększa odblokowanych
Poprawiono:
- premium dodane przez tipstera nie zwiększa licznika `Odblokowane`,
- odblokowania są liczone tylko z tabeli `unlocked_tips` dla zalogowanego usera,
- po wylogowaniu licznik odblokowanych wraca do 0 i nie miesza danych,
- usunięto stary globalny cache `betai_unlocked_tips_v1`,
- zakup po Stripe zapisuje dopiero po rozpoznaniu konkretnego user_id.

## Wersja 36 — DB-only unlock counter
Naprawa licznika `Odblokowane`:
- licznik nie używa już starego localStorage/cache,
- licznik jest brany tylko z tabeli `unlocked_tips`,
- dodanie typu premium nie zwiększa licznika,
- testowe odblokowanie lokalne jest wyłączone,
- po zapisie typu licznik odświeża się z Supabase.

## Wersja 37 — izolacja użytkowników
Poprawiono:
- nowy użytkownik nie dziedziczy zakupów/admina,
- licznik `Odblokowane` jest czyszczony przy zmianie konta i pobierany z Supabase tylko dla aktualnego `user_id`,
- panel boczny pokazuje dane aktualnie zalogowanego użytkownika,
- badge ADMIN tylko dla `smilhytv@gmail.com`,
- SQL wzmacnia RLS dla `unlocked_tips` i `payments`.

## Wersja 38 — fix logowania nowego usera
Naprawiono biały ekran po zalogowaniu nowym kontem:
- `sidebarProfile` jest teraz poprawnie zdefiniowany w Sidebar,
- sidebar pokazuje aktualnego użytkownika, nie hardcoded admina,
- build sprawdzony lokalnie.

## Wersja 39 — sidebar crash fix
Naprawiono biały ekran po loginie:
- `sidebarProfile` jest zdefiniowany w komponencie Sidebar,
- funkcja profilu jest przeniesiona przed Sidebar,
- sidebar pokazuje aktualne konto.

## Wersja 40 — safe login / no blank page
Naprawa białego ekranu po zalogowaniu nowym kontem:
- pełny bezpieczny Sidebar,
- ErrorBoundary pokazuje błąd zamiast białej strony,
- fetch unlocked/payments nie crashuje aplikacji,
- build sprawdzony.

## Wersja 41 — final sidebarProfile fix
Naprawiono crash:
- `sidebarProfile is not defined`
- wszystkie referencje `sidebarProfile` zostały zastąpione przez `profile`,
- build sprawdzony lokalnie.

## Wersja 42 — final profile crash fix
Naprawiono crash:
- `profile is not defined`
- usunięto pozostałe użycie `profile` poza Sidebarem,
- build sprawdzony lokalnie.

## Wersja 43 — widoczność typów per user
Poprawka:
- użytkownik widzi tylko swoje typy, darmowe typy i premium, które kupił,
- cudze premium nie pokazuje się innym kontom bez zakupu,
- nowe typy zapisują `author_id`, `user_id`, `author_email`,
- zakładka Zarobki liczy tylko typy autora, nie kupującego.

## Wersja 44 — profil i panel tipstera PRO
Dodano:
- zakładka `Mój profil`,
- statystyki użytkownika/tipstera,
- liczba dodanych typów,
- liczba typów premium,
- sprzedaże, przychód, prowizja i do wypłaty,
- lista moich typów,
- licznik odblokowanych,
- schema pod `tipster_profiles`.

## Wersja 45 — wypłaty tipstera
Dodano:
- zakładka `Wypłaty`,
- wyliczenie kwoty dostępnej do wypłaty,
- tabela historii wypłat,
- statusy `pending`, `approved`, `paid`, `rejected`,
- tworzenie requestu wypłaty w Supabase,
- schema `payout_requests`,
- przygotowanie pod Stripe Connect.

## Wersja 46 — payout UI fix
Naprawiono pusty ekran w zakładce Wypłaty:
- PayoutsView ma fallback gdy user/dane jeszcze się ładują,
- render zakładki Wypłaty jest poprawiony,
- brak tabeli payout_requests nie powinien wywalać UI.

## Wersja 47 — payout force render
Naprawiono pusty ekran Wypłaty:
- PayoutsView zawsze renderuje panel,
- usunięto wadliwy blok renderowania,
- dodano fallbacki dla pustych danych,
- schema `payout_requests` do uruchomienia w Supabase.

## Wersja 48 — profile + payout force render
Naprawiono:
- zakładka `Mój profil` zawsze renderuje pełny panel,
- profil ma fallbacki dla pustych danych,
- zakładka `Wypłaty` zostaje z wersji force render.

## Wersja 49 — admin wypłaty
Dodano:
- zakładka `Admin wypłaty` tylko dla smilhytv@gmail.com,
- lista wszystkich zgłoszeń wypłat,
- przyciski: Zatwierdź / Wypłacone / Odrzuć,
- statusy pending/approved/paid/rejected,
- SQL policy dla admina.

## Wersja 50 — limity wypłat Free/Premium
- Free: 1 wypłata/miesiąc
- Premium: 3 wypłaty/miesiąc
- backend blokuje limit przez Supabase RPC
- UI pokazuje plan, licznik i blokuje przycisk po limicie

## Wersja 51 — payout anti-spam
Naprawiono spam wypłat:
- przycisk blokuje się natychmiast po kliknięciu,
- UI pokazuje plan Free/Premium i licznik miesięczny,
- backend RPC blokuje drugi request w ciągu 10 sekund,
- backend pilnuje limitu: Free 1/miesiąc, Premium 3/miesiąc.

## Wersja 52 — FREE/VIP + saldo per user fix
Naprawiono:
- zwykłe konto pokazuje badge `FREE`, nie `VIP`,
- tylko `user_subscriptions.plan = premium` pokazuje `VIP`,
- admin dalej pokazuje `ADMIN`,
- saldo zwykłego usera domyślnie 0.00 zł, admin pokazuje testowe 1250.50 zł,
- SQL czyści duplikaty subskrypcji i dodaje unique index na `user_id`.

## Wersja 53 — userPlan crash fix
Naprawia błąd `userPlan is not defined`.

## Wersja 54 — final fix
Naprawia błąd `userPlan is not defined` w sidebarze.

## Wersja 55 — no userPlan crash
Naprawiono crash `userPlan is not defined` po logowaniu przez globalny fallback + poprawne przekazywanie planu do Sidebar.

## Wersja 56 — blokada fake doładowania
Naprawiono:
- zwykłe konto nie pokazuje już sztucznego salda z kliknięć,
- przycisk "Doładuj konto" nie dodaje już +100 zł,
- przygotowano tabelę wallet_transactions pod prawdziwy Stripe top-up,
- saldo zwykłego konta wraca do 0.00 zł do czasu realnej płatności.

## Wersja 57 — realne saldo + blokada premium typów dla FREE
- saldo zwykłego konta jest liczone z `wallet_transactions` (completed),
- fake saldo nie rośnie od kliknięć,
- FREE może dodać tylko darmowy typ,
- Premium/Admin mogą dodawać typy premium,
- backend trigger blokuje próby obejścia frontendu.

## Wersja 58 — fix trigger tips
Naprawiono błędy:
- `record "new" has no field "user_id"`
- `record "new" has no field "created_by"`

Trigger teraz bezpiecznie czyta pola przez `to_jsonb(new)`, więc nie crashuje gdy tabela `tips` ma inną nazwę kolumny autora.

## Wersja 59 — Premium Marketplace banner
Zmieniono komunikat marketplace premium na bardziej sprzedażowy i dodano CTA `Kup Premium`.

## Wersja 60 — friendly premium error
Zmieniono surowy błąd `FREE_USERS_CAN_ONLY_ADD_FREE_TIPS` na czytelny komunikat dla użytkownika:
`Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.`
