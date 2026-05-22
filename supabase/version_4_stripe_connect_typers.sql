-- WERSJA 4 — Stripe Connect dla sprzedaży typów/subskrypcji typera
-- Uruchom w Supabase SQL Editor. Bezpieczny patch: dodaje brakujące kolumny, indeksy i tabele.

create extension if not exists pgcrypto;

-- 1) Konta Stripe Connect typerów
create table if not exists public.user_stripe_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stripe_account_id text not null,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  connect_status text not null default 'onboarding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_stripe_accounts
  add column if not exists user_id uuid,
  add column if not exists stripe_account_id text,
  add column if not exists charges_enabled boolean default false,
  add column if not exists payouts_enabled boolean default false,
  add column if not exists details_submitted boolean default false,
  add column if not exists connect_status text default 'onboarding',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists user_stripe_accounts_user_unique
  on public.user_stripe_accounts(user_id);

create unique index if not exists user_stripe_accounts_account_unique
  on public.user_stripe_accounts(stripe_account_id)
  where stripe_account_id is not null;

-- 2) Cenniki subskrypcji profilu typera
create table if not exists public.tipster_plans (
  id uuid primary key default gen_random_uuid(),
  tipster_id uuid not null,
  plan_key text not null,
  label text,
  duration_days integer not null,
  price numeric not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tipster_plans
  add column if not exists tipster_id uuid,
  add column if not exists plan_key text,
  add column if not exists label text,
  add column if not exists duration_days integer default 30,
  add column if not exists price numeric default 1,
  add column if not exists active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists tipster_plans_tipster_key_unique
  on public.tipster_plans(tipster_id, plan_key);

-- 3) Aktywne subskrypcje kupujących do profilu typera
create table if not exists public.tipster_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  buyer_id uuid,
  tipster_id uuid not null,
  duration_days integer not null default 30,
  price numeric not null default 0,
  platform_fee numeric not null default 0,
  tipster_amount numeric not null default 0,
  stripe_session_id text,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tipster_subscriptions
  add column if not exists user_id uuid,
  add column if not exists buyer_id uuid,
  add column if not exists tipster_id uuid,
  add column if not exists duration_days integer default 30,
  add column if not exists price numeric default 0,
  add column if not exists platform_fee numeric default 0,
  add column if not exists tipster_amount numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'active',
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists tipster_subscriptions_user_tipster_unique
  on public.tipster_subscriptions(user_id, tipster_id);

create unique index if not exists tipster_subscriptions_session_unique
  on public.tipster_subscriptions(stripe_session_id)
  where stripe_session_id is not null;

-- 4) Zakupy pojedynczych typów
create table if not exists public.tip_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tip_id uuid not null,
  tipster_id uuid,
  price numeric not null default 0,
  platform_fee numeric not null default 0,
  tipster_amount numeric not null default 0,
  stripe_session_id text,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

alter table public.tip_purchases
  add column if not exists user_id uuid,
  add column if not exists tip_id uuid,
  add column if not exists tipster_id uuid,
  add column if not exists price numeric default 0,
  add column if not exists platform_fee numeric default 0,
  add column if not exists tipster_amount numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'paid',
  add column if not exists created_at timestamptz default now();

create unique index if not exists tip_purchases_user_tip_unique
  on public.tip_purchases(user_id, tip_id);

create unique index if not exists tip_purchases_session_unique
  on public.tip_purchases(stripe_session_id)
  where stripe_session_id is not null;

-- 5) Odblokowane typy po zakupie
create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tip_id uuid not null,
  price numeric default 0,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table public.unlocked_tips
  add column if not exists user_id uuid,
  add column if not exists tip_id uuid,
  add column if not exists price numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists created_at timestamptz default now();

create unique index if not exists unlocked_tips_user_tip_unique
  on public.unlocked_tips(user_id, tip_id);

-- 6) Zarobki typera i prowizja platformy
create table if not exists public.earnings (
  id uuid primary key default gen_random_uuid(),
  tipster_id uuid not null,
  user_id uuid,
  tip_id uuid,
  gross_amount numeric not null default 0,
  amount numeric not null default 0,
  commission numeric not null default 0,
  source text,
  stripe_session_id text,
  status text not null default 'available',
  created_at timestamptz not null default now()
);

alter table public.earnings
  add column if not exists tipster_id uuid,
  add column if not exists user_id uuid,
  add column if not exists tip_id uuid,
  add column if not exists gross_amount numeric default 0,
  add column if not exists amount numeric default 0,
  add column if not exists commission numeric default 0,
  add column if not exists source text,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'available',
  add column if not exists created_at timestamptz default now();

create index if not exists earnings_tipster_idx on public.earnings(tipster_id, created_at desc);
create unique index if not exists earnings_session_source_unique
  on public.earnings(stripe_session_id, source)
  where stripe_session_id is not null;

-- 7) Historia płatności / portfela — brakujące kolumny
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tip_id uuid,
  stripe_session_id text,
  amount numeric,
  currency text default 'pln',
  status text default 'paid',
  provider text default 'stripe',
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists user_id uuid,
  add column if not exists tip_id uuid,
  add column if not exists stripe_session_id text,
  add column if not exists amount numeric,
  add column if not exists currency text default 'pln',
  add column if not exists status text default 'paid',
  add column if not exists provider text default 'stripe',
  add column if not exists created_at timestamptz default now();

create unique index if not exists payments_stripe_session_unique
  on public.payments(stripe_session_id)
  where stripe_session_id is not null;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric not null default 0,
  type text,
  provider text,
  provider_session_id text,
  status text default 'completed',
  created_at timestamptz not null default now()
);

alter table public.wallet_transactions
  add column if not exists user_id uuid,
  add column if not exists amount numeric default 0,
  add column if not exists type text,
  add column if not exists provider text,
  add column if not exists provider_session_id text,
  add column if not exists status text default 'completed',
  add column if not exists created_at timestamptz default now();

create unique index if not exists wallet_transactions_provider_session_unique
  on public.wallet_transactions(provider_session_id)
  where provider_session_id is not null;

-- 8) RLS: włączone; service role z Netlify i tak ma pełny dostęp.
alter table public.user_stripe_accounts enable row level security;
alter table public.tipster_plans enable row level security;
alter table public.tipster_subscriptions enable row level security;
alter table public.tip_purchases enable row level security;
alter table public.unlocked_tips enable row level security;
alter table public.earnings enable row level security;

-- Widoczność własnych danych i publicznych planów.
drop policy if exists "user_stripe_accounts_select_own" on public.user_stripe_accounts;
create policy "user_stripe_accounts_select_own"
on public.user_stripe_accounts for select to authenticated
using (user_id = auth.uid());

drop policy if exists "tipster_plans_select_public" on public.tipster_plans;
create policy "tipster_plans_select_public"
on public.tipster_plans for select to anon, authenticated
using (active = true or tipster_id = auth.uid());

drop policy if exists "tipster_plans_manage_own" on public.tipster_plans;
create policy "tipster_plans_manage_own"
on public.tipster_plans for all to authenticated
using (tipster_id = auth.uid())
with check (tipster_id = auth.uid());

drop policy if exists "tipster_subscriptions_select_own" on public.tipster_subscriptions;
create policy "tipster_subscriptions_select_own"
on public.tipster_subscriptions for select to authenticated
using (user_id = auth.uid() or buyer_id = auth.uid() or tipster_id = auth.uid());

drop policy if exists "tip_purchases_select_own" on public.tip_purchases;
create policy "tip_purchases_select_own"
on public.tip_purchases for select to authenticated
using (user_id = auth.uid() or tipster_id = auth.uid());

drop policy if exists "unlocked_tips_select_own" on public.unlocked_tips;
create policy "unlocked_tips_select_own"
on public.unlocked_tips for select to authenticated
using (user_id = auth.uid());

drop policy if exists "earnings_select_own" on public.earnings;
create policy "earnings_select_own"
on public.earnings for select to authenticated
using (tipster_id = auth.uid());

select 'WERSJA 4 Stripe Connect SQL OK' as status;
