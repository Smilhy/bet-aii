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

## Wersja 61 — realne saldo + przyjazny inline error
- Zamiast `FREE_USERS_CAN_ONLY_ADD_FREE_TIPS` pokazuje: `Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.`
- Saldo w sidebarze jest brane z `get_wallet_balance()` i tabeli `wallet_transactions`.
- Usunięte fake saldo 1250/2550 dla zwykłych kont i admina.
- Przycisk `Doładuj konto` nie dodaje pieniędzy bez Stripe.

## Wersja 62 — inline error + premium UX fix
Naprawiono dolny czerwony komunikat:
- zamiast `FREE_USERS_CAN_ONLY_ADD_FREE_TIPS` pokazuje:
  `Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.`
- dodatkowo formatowanie błędów działa dla toastów i boxów formularza.

## Wersja 63 — final inline message fix
Naprawiono konkretnie `setMessage('Błąd zapisu: ' + error.message)`, które nadal pokazywało surowy błąd z Supabase. Teraz dolny czerwony box pokazuje:
`Błąd zapisu: Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.`

## Wersja 65 — exact premium text fix
Dodano dokładny tekst przy opcji Premium i w czerwonym komunikacie:
`Konto FREE może dodawać tylko darmowe typy. Kup Premium, aby publikować i sprzedawać typy premium.`

## Wersja 66 — realne saldo Stripe
Dodano:
- `netlify/functions/create-wallet-checkout.js` — tworzy Stripe Checkout do doładowania konta,
- `netlify/functions/stripe-webhook.js` — po płatności zapisuje `wallet_transactions`,
- saldo jest liczone z `get_wallet_balance`,
- `Doładuj konto` nie dodaje fake kasy, tylko prowadzi do Stripe.
Wymagane ENV w Netlify:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL albo SUPABASE_URL

## Wersja 67 — realne saldo, Premium Stripe, admin payout flow
Dodano:
- reset fake salda w SQL (`wallet_transactions` bez Stripe session są usuwane),
- realne saldo liczone z webhooków Stripe,
- `create-premium-checkout.js` — zakup Premium,
- webhook aktywuje `user_subscriptions.plan = premium`,
- zakup Premium zapisuje się jako `premium_purchase`,
- admin panel wypłat zostaje w projekcie: zatwierdź / wypłacone / odrzuć.
Wymagane ENV:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL albo SUPABASE_URL

## Wersja 69 — build fix
Naprawiono błąd JSX:
`Expected ">" but found ")"` przy przycisku `premium-banner-cta`.

## Wersja 70 — runtime fix
Naprawiono błąd po logowaniu: `startPremiumCheckout is not defined`.
Banner Premium korzysta z bezpiecznego globalnego handlera i nie wywala aplikacji.

## Wersja 71 — premium handler scope fix
Naprawiono błąd po logowaniu: `startPremiumCheckout is not defined`.
Wszystkie przyciski Premium wysyłają event, a prawdziwy Stripe Checkout uruchamia się wewnątrz App.

## Wersja 72 — real wallet zero fix
Naprawiono:
- usunięto fake stan `useState(1250.50)`,
- Sidebar i Portfel pokazują `walletBalance` z Supabase RPC,
- SQL czyści wszystkie stare/testowe transakcje portfela przez `truncate wallet_transactions`,
- nowe konto ma 0.00 zł,
- saldo rośnie tylko po Stripe webhook.

## Wersja 73 — wallet per-user fix
Naprawiono portfel:
- Sidebar i Portfel używają prawdziwego props `wallet`, nie wspólnej/starej zmiennej.
- Saldo resetuje się do 0 przy zmianie konta / logout / login.
- Saldo pobierane jest przez RPC `get_wallet_balance(user_id)`.
- SQL czyści całą tabelę `wallet_transactions`, żeby każde konto startowało od 0.

## Wersja 74 — realny zakup premium typów z portfela
Dodano:
- RPC `purchase_premium_tip(tip_id)`,
- zakup premium typu pobiera środki z `wallet_transactions`,
- odblokowanie typu zapisuje się w `unlocked_tips`,
- sprzedaż zapisuje się w `payments`,
- błędy: brak środków, już kupione, własny typ.

## Wersja 75 — panel zarobków UI
Dodano:
- panel zarobków tipstera,
- łączny zarobek,
- liczba sprzedaży,
- zarobek w tym miesiącu,
- historia transakcji `earning`,
- SQL: 20% prowizji platformy i 80% dla tipstera.

## Wersja 76 — getDisplayRole fix
Naprawiono błąd aplikacji po logowaniu: `getDisplayRole is not defined`.

## Wersja 77 — Stripe Premium auto
Dodano:
- `create-premium-checkout.js` do zakupu Premium przez Stripe,
- webhook `stripe-webhook.js` automatycznie ustawia `user_subscriptions.plan = premium`,
- zakup Premium zapisuje transakcję `premium_purchase`,
- przyciski Premium prowadzą do Stripe Checkout.
Wymagane ENV:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL albo SUPABASE_URL
Opcjonalnie:
- PREMIUM_PRICE_GROSZE, np. 2900 = 29 zł

## Wersja 78 — wypłaty tipsterów + admin zatwierdza
Dodano:
- tipster może kliknąć `Poproś o wypłatę`,
- minimalna wypłata 10 zł,
- limity: FREE 1/miesiąc, Premium 3/miesiąc,
- admin panel zatwierdza jako `paid` lub odrzuca,
- po zatwierdzeniu dodaje się transakcja `wallet_transactions.type = payout`.

## Wersja 79 — Stripe Connect wypłaty
Dodano:
- `create-stripe-account.js` — tworzy konto Stripe Express i link onboarding,
- `send-tipster-payout.js` — admin wysyła realną wypłatę Stripe transferem,
- tabela `user_stripe_accounts`,
- karta Stripe Connect w panelu Zarobki,
- webhook obsługuje `account.updated` do aktualizacji statusu konta Stripe.
Stripe webhook events:
- checkout.session.completed
- account.updated
Wymagane ENV:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL albo SUPABASE_URL

## Wersja 80 — Stripe Connect loading fix
Naprawiono zawieszanie aplikacji na `Ładowanie sesji...`:
- dodano brakujące funkcje `fetchStripeConnectStatus` i `connectStripeAccount`,
- init sesji jest zabezpieczony try/finally, więc loader zawsze znika,
- błędy fetchów nie blokują aplikacji.

## Wersja 81 — Admin finance dashboard
Dodano:
- panel admina `Admin finanse`,
- raport prowizji platformy 20%,
- sprzedaż premium, obrót brutto, zarobki tipsterów,
- wypłacone i pending wypłaty,
- historia transakcji marketplace,
- SQL `get_admin_finance_report()`.

## Wersja 82 — Admin finanse menu fix
Naprawiono brak zakładki `📊 Admin finanse` w lewym menu.
Dodano render widoku `AdminFinanceView` oraz automatyczne odświeżanie raportu po wejściu w zakładkę.

## Wersja 83 — isAdminUser fix
Naprawiono błąd po zalogowaniu: `isAdminUser is not defined`.
Admin rozpoznawany po emailu `smilhytv@gmail.com`.

## Wersja 84 — Admin finance render fix
Naprawiono pustą zakładkę `Admin finanse`: dodano brakujący render `<AdminFinanceView />` w głównym widoku.

## Wersja 85 — Admin finanse visible fix
Naprawiono pustą stronę po kliknięciu `Admin finanse`: render bloku został dodany bezpośrednio do `<main>`.

## Wersja 86 — final admin approve UI
Dodano:
- osobna zakładka `🏦 Admin wypłaty`,
- przyciski `✅ Zatwierdź i wypłacone` oraz `❌ Odrzuć`,
- fallback: jeśli Stripe Connect transfer nie przejdzie, admin nadal może ręcznie oznaczyć wypłatę jako paid,
- `admin_logs` zapisuje kto i kiedy zatwierdził/odrzucił payout.

## Wersja 87 — Admin wypłaty menu/render fix
Naprawiono brak widocznej zakładki `🏦 Admin wypłaty`.
Dodano render widoku i przyciski:
- ✅ Zatwierdź i wypłacone
- ❌ Odrzuć

## Wersja 88 — realne Stripe Connect payouts
Dodano:
- `create-stripe-account.js` — tipster tworzy konto Stripe Express i onboarding link,
- `send-real-stripe-payout.js` — admin zatwierdza payout i wykonywany jest realny Stripe transfer,
- `stripe-webhook.js` obsługuje `account.updated`,
- tabela `user_stripe_accounts`,
- kolumny `stripe_transfer_id`, `stripe_status` w `payout_requests`,
- karta Stripe Connect w panelu Zarobki.
W Stripe webhook dodaj eventy:
- `checkout.session.completed`
- `account.updated`
Wymagane ENV:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL albo SUPABASE_URL

## Wersja 89 — Stripe Connect backend ready
Gotowy backend Stripe Connect:
- netlify/functions/create-stripe-account.js
- netlify/functions/refresh-stripe-account.js
- netlify/functions/send-real-stripe-payout.js
- netlify/functions/stripe-webhook.js

Netlify ENV:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL lub VITE_SUPABASE_URL
- SITE_URL opcjonalnie

Stripe webhook events:
- checkout.session.completed
- account.updated

Flow:
1. Tipster -> Zarobki -> Połącz Stripe.
2. Stripe onboarding zapisuje account ID w user_stripe_accounts.
3. Webhook account.updated ustawia payouts_enabled.
4. Admin -> Admin wypłaty -> Zatwierdź i wypłacone.
5. send-real-stripe-payout robi Stripe transfer.

## Wersja 90 — payout toast + Stripe status fix
Naprawiono:
- brak komunikatu po kliknięciu `Poproś o wypłatę`, gdy saldo do wypłaty wynosi 0 zł,
- stary tekst `Następny etap: Stripe Connect` w zakładce Wypłaty,
- przycisk wypłaty nie jest już blokowany bez komunikatu.
\n## Wersja 91 — real payout approve\nDodano realny endpoint `/.netlify/functions/approve-payout`, który robi Stripe transfer do connected account, ustawia payout jako `paid`, zapisuje `stripe_transfer_id`, ledger payout i admin log.\n

## Wersja 92 — finalizacja wypłat Stripe Connect

Dodane:
- minimum payout: 50 zł po stronie frontendu i Supabase RPC `create_payout_request`,
- manualny admin approve wykonuje realny Stripe transfer przez `/.netlify/functions/approve-payout`,
- po transferze payout dostaje status `paid`, `stripe_status=transferred`, `stripe_transfer_id` i `processed_at`,
- panel Admin wypłaty PRO pokazuje status Stripe, transfer ID i sekcję cron,
- automatyczne wypłaty cron: `/.netlify/functions/process-payouts`,
- cron obsługuje pending wypłaty >= 50 zł, Stripe Connect `payouts_enabled`, idempotency key oraz logi w `admin_logs`.

Wymagane env na Netlify:
- `STRIPE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` albo `VITE_SUPABASE_URL`
- opcjonalnie `MIN_PAYOUT_AMOUNT=50`
- opcjonalnie `PAYOUT_CRON_BATCH_SIZE=10`
- opcjonalnie `CRON_SECRET` dla ręcznego wywołania endpointu


## Wersja 93 — production polish payout flow

Dodane w tej paczce:
- statusy wypłat: `pending`, `processing`, `paid`, `failed`, `rejected`, `blocked_minimum`,
- manualny `Stripe transfer` blokuje request przez `processing`, żeby nie zrobić duplikatu,
- cron `process-payouts` też blokuje request przed transferem i finalizuje jako `paid`,
- failed payout zapisuje `stripe_status = failed` oraz `stripe_error`,
- admin panel nie pokazuje już aktywnego transferu dla `rejected/paid/failed`, tylko stan zamknięty,
- przycisk testowego uruchomienia crona z panelu admina,
- wypłaty poniżej 50 zł nie są przetwarzane i przycisk transferu jest zablokowany.

Przed testem na Netlify/Supabase uruchom końcówkę `supabase/schema.sql`, żeby dodać nowe statusy i kolumnę `stripe_error`.

## Wersja 94 — Stripe SaaS subscriptions + paywall

Dodane w tej paczce:
- Stripe Checkout w trybie `subscription` dla Premium SaaS.
- Obsługa `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` w webhooku.
- Stripe Billing Portal przez `/.netlify/functions/create-customer-portal`.
- Nowy ekran `Subskrypcja` w sidebarze.
- Paywall: konto FREE nie zapisze płatnego typu premium; Premium/admin może publikować premium.
- Rozszerzenie tabeli `user_subscriptions` o status Stripe, customer ID, subscription ID, okres rozliczeniowy i cancel flag.

ENV do ustawienia w Netlify:
- `STRIPE_PREMIUM_PRICE_ID` — rekomendowane, miesięczny Price z Stripe Dashboard.
- `PREMIUM_MONTHLY_PRICE_GROSZE=2900` — fallback, gdy nie podasz Price ID.
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Webhook Stripe powinien nasłuchiwać minimum:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `account.updated` dla Stripe Connect wypłat

Po deployu przetestuj:
1. Konto FREE → próba dodania premium typu powinna pokazać blokadę paywall.
2. Kliknij Subskrypcja → Aktywuj Premium przez Stripe.
3. Po powrocie i webhooku konto ma status Premium.
4. Konto Premium może dodać typ premium.
5. Billing Portal otwiera zarządzanie/anulowanie subskrypcji.

## Wersja 95 — realny Stripe SaaS webhook bez ręcznego wklejania kodu

Ta wersja ma już gotowe pliki Netlify Functions:
- `netlify/functions/create-premium-checkout.js` — tworzy lub odzyskuje Stripe Customer i zapisuje `stripe_customer_id`.
- `netlify/functions/stripe-webhook.js` — obsługuje `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` i synchronizuje Premium do `profiles` oraz `user_subscriptions`.
- `netlify/functions/create-customer-portal.js` — działa z `profiles` albo `user_subscriptions`.

Webhook w Stripe ustaw na:
`https://TWOJA-STRONA.netlify.app/.netlify/functions/stripe-webhook`

Eventy:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Jeśli w Supabase masz już `profiles`, wystarczy deploy paczki. Jeśli nie masz jeszcze pełnych kolumn subskrypcji, użyj pliku:
`supabase/subscriptions_profiles_patch.sql`.

## v96 fix — Stripe Premium customer linking

Ta wersja poprawia webhook Premium tak, żeby po płatności nie szukał użytkownika tylko po `stripe_customer_id`, ale także po:
- `client_reference_id`
- `metadata.user_id`
- emailu z Checkout Session
- emailu Stripe Customer

Dzięki temu testowa płatność Premium powinna ustawić w Supabase:
- `profiles.plan = premium`
- `profiles.subscription_status = active`
- `profiles.stripe_customer_id = cus_...`

Po deployu sprawdź w Supabase:
`select * from profiles;`

## Wersja 98 — Stripe Premium final sync fix

Ta wersja naprawia finalny problem Premium: Stripe przyjmował subskrypcję, ale aplikacja dalej widziała konto jako FREE.

Naprawione:
- Checkout przekazuje i utrzymuje `client_reference_id = user_id` oraz `metadata.user_id`.
- Webhook wymusza update `profiles.plan = premium` i `subscription_status = active` po udanej subskrypcji.
- `sync-premium-session` po powrocie ze Stripe twardo sprawdza sesję/subskrypcję i aktualizuje Supabase.
- Frontend nie blokuje Premium przez stary rekord `user_subscriptions = inactive`, jeśli `profiles` mówi Premium.
- Dodana ochrona przed tworzeniem kolejnych aktywnych subskrypcji dla tego samego Stripe customer.

SQL nie jest wymagany, jeśli tabela `profiles` i kolumny subskrypcji już istnieją.

## Wersja 99 — premium tips access fix
- Formularz dodawania typu rozpoznaje konto VIP/Premium przy publikowaniu typów premium.
- Blokada FREE nie pokazuje się już użytkownikowi Premium.
- Nie wymaga dodatkowego SQL.


## Wersja 100 — premium tip flag/profile fix
- Naprawiono rozpoznawanie premium tipów po `access_type = premium`.
- Dodawanie typu premium zapisuje teraz także `is_premium = true`.
- Profil liczy premium typy poprawnie i nie pokazuje ich jako Free.

## Wersja 103 — Tipster pricing + profile subscriptions

Dodano pełny model marketplace:

- tipster sam ustala cenę pojedynczego typu w formularzu dodawania typu,
- tipster PREMIUM ustawia ceny dostępu do swojego profilu: 1 tydzień, 1 miesiąc, 6 miesięcy, 1 rok,
- użytkownik może kupić pojedynczy typ albo dostęp do całego profilu tipstera,
- platforma pobiera zawsze 20%, tipster dostaje 80%,
- Stripe Checkout obsługuje zakup pojedynczego typu i dostęp do profilu,
- webhook zapisuje `tip_purchases`, `tipster_subscriptions`, `earnings` i `unlocked_tips`.

### SQL wymagany dla tej wersji

W Supabase SQL Editor uruchom plik:

`supabase/marketplace_tipster_subscriptions.sql`

Jeśli tabele już istnieją, skrypt używa `if not exists` i `add column if not exists`.

## Wersja 104 — Stripe marketplace step 1

Ta wersja spina realny Stripe checkout z marketplace:

- zakup pojedynczego typu premium,
- zakup dostępu do profilu tipstera,
- zapis `unlocked_tips`, `tip_purchases`, `tipster_subscriptions`, `earnings`,
- prowizja platformy 20%, tipster 80%,
- endpointy walidują ceny z Supabase, a nie z frontendu.

### SQL wymagany
Wklej w Supabase SQL Editor:

`supabase/marketplace_stripe_step1.sql`

Po deployu test:
1. ustaw cenę typu premium,
2. kup typ kartą testową Stripe,
3. sprawdź `unlocked_tips`, `tip_purchases`, `earnings`,
4. kup dostęp do profilu tipstera i sprawdź `tipster_subscriptions`.

## Wersja 108 — PRO marketplace layer

Dodane:
- ranking tipsterów PRO na podstawie ROI, winrate, zarobków i liczby typów,
- follow tipstera,
- powiadomienia o nowych typach od obserwowanych tipsterów,
- widok powiadomień w sidebarze,
- SQL pod `tipster_follows`, `notifications`, widok `tipster_rankings`, helper auto payouts.

### SQL do Supabase
Wklej w Supabase SQL Editor:

`supabase/pro_features_ranking_follow_notifications.sql`

### Auto payouts Stripe
Endpoint dalej działa jako Netlify Scheduled Function:

`/.netlify/functions/process-payouts`

W ENV możesz ustawić:
- `CRON_SECRET`
- `MIN_PAYOUT_AMOUNT=50`
- `PAYOUT_CRON_BATCH_SIZE=10`
- `PAYOUT_CRON_SCHEDULE=0 * * * *`
