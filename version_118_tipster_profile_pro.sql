-- BetAI v104 — Stripe marketplace step 1
-- Kupno pojedynczego typu + subskrypcja profilu tipstera + prowizja 20%.
-- Wklej w Supabase SQL Editor i uruchom raz. Skrypt jest bezpieczny dla istniejących tabel.

-- 1) Odblokowane typy po zakupie
create table if not exists public.unlocked_tips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric default 0,
  stripe_session_id text,
  created_at timestamp default now()
);

alter table public.unlocked_tips add column if not exists price numeric default 0;
alter table public.unlocked_tips add column if not exists stripe_session_id text;

create unique index if not exists uq_unlocked_tips_user_tip on public.unlocked_tips(user_id, tip_id);
create index if not exists idx_unlocked_tips_user on public.unlocked_tips(user_id);
create index if not exists idx_unlocked_tips_tip on public.unlocked_tips(tip_id);

-- 2) Historia kupionych pojedynczych typów
create table if not exists public.tip_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric default 0,
  created_at timestamp default now()
);

alter table public.tip_purchases add column if not exists tipster_id uuid references public.profiles(id) on delete set null;
alter table public.tip_purchases add column if not exists platform_fee numeric not null default 0;
alter table public.tip_purchases add column if not exists tipster_amount numeric not null default 0;
alter table public.tip_purchases add column if not exists stripe_session_id text;
alter table public.tip_purchases add column if not exists status text default 'paid';

create index if not exists idx_tip_purchases_user on public.tip_purchases(user_id);
create index if not exists idx_tip_purchases_tip on public.tip_purchases(tip_id);
create index if not exists idx_tip_purchases_tipster on public.tip_purchases(tipster_id);
create unique index if not exists uq_tip_purchases_session on public.tip_purchases(stripe_session_id) where stripe_session_id is not null;

-- 3) Cennik tipstera: tydzień / miesiąc / 6 miesięcy / rok
create table if not exists public.tipster_plans (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid references public.profiles(id) on delete cascade,
  plan_key text,
  label text,
  duration_days int,
  price numeric not null default 0,
  active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.tipster_plans add column if not exists plan_key text;
alter table public.tipster_plans add column if not exists label text;
alter table public.tipster_plans add column if not exists duration_days int;
alter table public.tipster_plans add column if not exists price numeric not null default 0;
alter table public.tipster_plans add column if not exists active boolean default true;
alter table public.tipster_plans add column if not exists updated_at timestamp default now();

create index if not exists idx_tipster_plans_tipster on public.tipster_plans(tipster_id);
create unique index if not exists uq_tipster_plans_tipster_key on public.tipster_plans(tipster_id, plan_key) where plan_key is not null;

-- 4) Aktywne dostępy do profilu tipstera
create table if not exists public.tipster_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tipster_id uuid references public.profiles(id) on delete cascade,
  duration_days int,
  price numeric not null default 0,
  platform_fee numeric not null default 0,
  tipster_amount numeric not null default 0,
  stripe_session_id text,
  status text default 'active',
  expires_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.tipster_subscriptions add column if not exists duration_days int;
alter table public.tipster_subscriptions add column if not exists price numeric not null default 0;
alter table public.tipster_subscriptions add column if not exists platform_fee numeric not null default 0;
alter table public.tipster_subscriptions add column if not exists tipster_amount numeric not null default 0;
alter table public.tipster_subscriptions add column if not exists stripe_session_id text;
alter table public.tipster_subscriptions add column if not exists status text default 'active';
alter table public.tipster_subscriptions add column if not exists updated_at timestamp default now();

create index if not exists idx_tipster_subscriptions_user on public.tipster_subscriptions(user_id);
create index if not exists idx_tipster_subscriptions_tipster on public.tipster_subscriptions(tipster_id);
create unique index if not exists uq_tipster_subscriptions_user_tipster on public.tipster_subscriptions(user_id, tipster_id);
create unique index if not exists uq_tipster_subscriptions_session on public.tipster_subscriptions(stripe_session_id) where stripe_session_id is not null;

-- Kompatybilność z wcześniejszą nazwą user_subscriptions.
create table if not exists public.user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tipster_id uuid references public.profiles(id) on delete cascade,
  price numeric default 0,
  stripe_session_id text,
  status text default 'active',
  expires_at timestamp,
  created_at timestamp default now()
);

alter table public.user_subscriptions add column if not exists price numeric default 0;
alter table public.user_subscriptions add column if not exists stripe_session_id text;
alter table public.user_subscriptions add column if not exists status text default 'active';
create index if not exists idx_user_subscriptions_user on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_tipster on public.user_subscriptions(tipster_id);
create unique index if not exists uq_user_subscriptions_user_tipster on public.user_subscriptions(user_id, tipster_id);

-- 5) Zarobki tipstera i prowizja platformy
create table if not exists public.earnings (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid references public.profiles(id) on delete cascade,
  amount numeric not null default 0,
  commission numeric not null default 0,
  source text default 'tip_purchase',
  created_at timestamp default now()
);

alter table public.earnings add column if not exists tipster_id uuid;
alter table public.earnings add column if not exists user_id uuid;
alter table public.earnings add column if not exists tip_id uuid;
alter table public.earnings add column if not exists gross_amount numeric not null default 0;
alter table public.earnings add column if not exists amount numeric not null default 0;
alter table public.earnings add column if not exists commission numeric not null default 0;
alter table public.earnings add column if not exists source text default 'tip_purchase';
alter table public.earnings add column if not exists stripe_session_id text;
alter table public.earnings add column if not exists status text default 'available';

create index if not exists idx_earnings_tipster on public.earnings(tipster_id);
create unique index if not exists uq_earnings_session_source on public.earnings(stripe_session_id, source) where stripe_session_id is not null;

-- 6) Funkcja dostępu: kupiony typ albo aktywna subskrypcja profilu
create or replace function public.has_access_to_tip(p_user uuid, p_tip uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tip_owner uuid;
  has_single_purchase boolean;
  has_profile_subscription boolean;
begin
  select author_id into tip_owner
  from public.tips
  where id = p_tip;

  if tip_owner is null then
    return false;
  end if;

  if tip_owner = p_user then
    return true;
  end if;

  select exists (
    select 1 from public.unlocked_tips
    where user_id = p_user and tip_id = p_tip
  ) or exists (
    select 1 from public.tip_purchases
    where user_id = p_user and tip_id = p_tip and coalesce(status, 'paid') = 'paid'
  ) into has_single_purchase;

  select exists (
    select 1 from public.tipster_subscriptions
    where user_id = p_user
      and tipster_id = tip_owner
      and coalesce(status, 'active') = 'active'
      and (expires_at is null or expires_at > now())
  ) or exists (
    select 1 from public.user_subscriptions
    where user_id = p_user
      and tipster_id = tip_owner
      and coalesce(status, 'active') = 'active'
      and (expires_at is null or expires_at > now())
  ) into has_profile_subscription;

  return has_single_purchase or has_profile_subscription;
end;
$$;
