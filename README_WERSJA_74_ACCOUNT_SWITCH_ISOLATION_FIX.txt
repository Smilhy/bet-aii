BetAI WERSJA 74 — ACCOUNT SWITCH ISOLATION FIX

Problem zgłoszony:
Po przełączeniu smilhytv -> buchajson1988 -> smilhytv przez chwilę było dobrze,
a po kilku sekundach część UI wracała do danych drugiego konta:
- Coiny jednego konta na drugim,
- profil/yield/typy potrafiły się mieszać,
- F5 pomagał tylko na chwilę.

Znalezione przyczyny:
1. buildEffectiveAccountProfile scalał accountProfile i sessionUser nawet wtedy,
   gdy należały do dwóch różnych user_id/email.
2. fetchUserPlan był wywoływany z userId nowego konta, ale mógł czytać sessionUser
   ze starego closure. To pozwalało zbudować profil z dwóch kont.
3. Premium profile robił merge z prev accountProfile, więc brakujące pola nowego konta
   pozostawały ze starego konta.
4. Spóźnione requesty/timery poprzedniego konta mogły po kilku sekundach wykonać setState.
5. Saldo Coin używało Math.max(remote, local), więc jeśli localStorage raz dostał zły,
   wyższy stan, poprawny niższy stan z Supabase nie mógł go już naprawić.
6. ensureUserWalletAndWelcome także mógł po spóźnionej odpowiedzi ustawić saldo starego konta.

Naprawa V74:
- twarda izolacja po user_id + email,
- account epoch: odpowiedzi starych requestów są odrzucane,
- natychmiastowy reset danych zależnych od konta przy zmianie loginu,
- fetchUserPlan buduje profil wyłącznie dla przekazanego user_id,
- Premium profile zastępuje stary profil zamiast go scalać,
- opóźnione startup tasks mają właściciela user_id i nie wykonują się po zmianie konta,
- fetchTips / fast feed ignoruje rezultat starego konta,
- wallet, notifications, follows, referrals, payout, earnings, Stripe, unlocked tips
  mają guard aktywnego konta,
- Supabase wallet jest źródłem prawdy dla Coin; poprawny remote balance nadpisuje
  potencjalnie błędny local cache,
- realtime wallet/notifications/tip transfer sprawdzają aktywne user_id/email.

Nie zmieniono:
- logiki typów,
- rankingu/podium V73,
- Algorytmu,
- kursów,
- rozliczania,
- Supabase SQL.

Po deployu zalecane:
1. Wylogować się raz.
2. Zalogować na smilhytv.
3. Zrobić Ctrl+F5.
4. Przetestować smilhytv -> buchajson1988 -> smilhytv.

SQL nie jest potrzebny.
