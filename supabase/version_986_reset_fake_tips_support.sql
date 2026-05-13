-- WERSJA 986 — NAPIWKI = REALNE WSPARCIE, NIE STATYSTYKI TYPÓW
-- Uruchom w Supabase SQL Editor.
-- Nie rusza CORE LOCK v983: nie zmienia liczenia profit/yield/rankingu/typów.
--
-- Problem:
-- kafelek "Napiwki" pokazywał fałszywe wartości, bo frontend brał imported_tips_amount / tips_earnings.
-- imported_tips_amount w tej aplikacji było używane jako licznik typów/statystyk, a nie jako napiwek.
--
-- Zasada od v986:
-- Napiwki pokazują tylko realne wsparcie społeczności.
-- Jeśli nie ma realnych wpłat/wsparcia, każdy profil pokazuje 0.00 zł.

begin;

alter table public.profiles add column if not exists support_tips_amount numeric default 0;
alter table public.profiles add column if not exists community_tips_amount numeric default 0;
alter table public.profiles add column if not exists received_tips_amount numeric default 0;
alter table public.profiles add column if not exists tips_currency text default 'zł';

-- Wyzeruj fałszywe pola wsparcia dla całej strony.
-- To NIE zeruje profitu z typów.
update public.profiles
set
  support_tips_amount = 0,
  community_tips_amount = 0,
  received_tips_amount = 0,
  tips_currency = coalesce(tips_currency, imported_tips_currency, 'zł');

-- Jeżeli są stare techniczne kolumny, które mogły fałszywie zasilać napiwki, też je zerujemy.
do $func$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'tips_earnings'
  ) then
    execute 'update public.profiles set tips_earnings = 0';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'tips_total'
  ) then
    execute 'update public.profiles set tips_total = 0';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'tips_income'
  ) then
    execute 'update public.profiles set tips_income = 0';
  end if;
end;
$func$;

-- Publiczny widok/funkcja profili mają zwracać nowe pola, jeżeli frontend ich potrzebuje.
create or replace view public.betai_public_profiles_for_ui_view as
select
  p.id,
  p.email,
  p.username,
  p.public_slug,
  p.avatar_url,
  p.bio,
  p.description,
  p.about,
  p.created_at,
  p.updated_at,
  p.followers_count,
  p.following_count,
  p.plan,
  p.subscription_status,
  p.is_admin,
  p.is_premium,
  p.imported_yield,
  p.imported_total_tips,
  p.imported_won_tips,
  p.imported_lost_tips,
  p.imported_pending_tips,
  p.imported_total_staked,
  p.imported_profit,
  p.imported_avg_odds,
  p.imported_highest_odds,
  p.imported_tips_amount,
  p.imported_tips_currency,
  p.stats_imported_at,
  p.rating_avg,
  p.rating_count,
  p.reviews_count,
  p.rating_distribution,
  p.support_tips_amount,
  p.community_tips_amount,
  p.received_tips_amount,
  p.tips_currency
from public.profiles p;

grant select on public.betai_public_profiles_for_ui_view to anon, authenticated;

commit;
