-- WERSJA 589 — zasady FREE / PREMIUM / ADMIN / marketplace
-- Uruchom w Supabase SQL Editor, aby zasady były zapisane również w bazie.

-- 1) Każdy nowy/zwykły użytkownik startuje jako FREE.
-- 2) Premium NIE daje admina.
-- 3) Admin tylko smilhytv / smilhytv@gmail.com.
-- 4) FREE: 5 typów / 24h, 1 wypłata / miesiąc, brak sprzedaży płatnych typów i subskrypcji profilu.
-- 5) PREMIUM: brak limitu typów, 3 wypłaty / miesiąc, może sprzedawać single i subskrypcje profilu.
-- 6) Marketplace: 80% dla tipstera, 20% dla platformy/admina.
-- 7) Premium strony: 100% dla platformy/admina.
-- 8) Każda wypłata na konto bankowe: realizacja do 7 dni.

alter table if exists public.profiles
  add column if not exists plan text default 'free',
  add column if not exists is_premium boolean default false,
  add column if not exists is_admin boolean default false,
  add column if not exists subscription_status text default 'free';

-- Zabezpieczenie: adminem zostaje tylko właściciel strony.
update public.profiles
set is_admin = false
where lower(coalesce(email, '')) <> 'smilhytv@gmail.com'
  and lower(coalesce(username, '')) <> 'smilhytv';

update public.profiles
set is_admin = true,
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active'
where lower(coalesce(email, '')) = 'smilhytv@gmail.com'
   or lower(coalesce(username, '')) = 'smilhytv';

-- Zwykli użytkownicy bez aktywnej subskrypcji zostają FREE.
update public.profiles
set plan = 'free',
    is_premium = false,
    subscription_status = coalesce(nullif(subscription_status, ''), 'free')
where coalesce(is_admin, false) = false
  and lower(coalesce(subscription_status, 'free')) not in ('active', 'trialing', 'premium');
