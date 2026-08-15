-- WERSJA 6 — Stripe Connect bez triggerów i bez resetowania strony
-- Uruchom raz w aktualnym zdrowym projekcie Supabase PRZED testem Podłącz Stripe.

create table if not exists public.user_stripe_accounts (
  user_id uuid primary key,
  stripe_account_id text unique,
  connect_status text default 'not_connected',
  status text default 'not_connected',
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  details_submitted boolean default false,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sync_at timestamptz
);

alter table public.user_stripe_accounts
  add column if not exists stripe_account_id text,
  add column if not exists connect_status text default 'not_connected',
  add column if not exists status text default 'not_connected',
  add column if not exists charges_enabled boolean default false,
  add column if not exists payouts_enabled boolean default false,
  add column if not exists details_submitted boolean default false,
  add column if not exists onboarding_completed boolean default false,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists last_sync_at timestamptz;

create unique index if not exists user_stripe_accounts_user_id_unique
  on public.user_stripe_accounts (user_id);

create unique index if not exists user_stripe_accounts_stripe_account_unique
  on public.user_stripe_accounts (stripe_account_id)
  where stripe_account_id is not null;

alter table public.profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists connect_status text default 'not_connected',
  add column if not exists stripe_connect_status text default 'not_connected',
  add column if not exists stripe_connect_charges_enabled boolean default false,
  add column if not exists stripe_connect_payouts_enabled boolean default false,
  add column if not exists stripe_connect_details_submitted boolean default false,
  add column if not exists stripe_connect_onboarding_completed boolean default false,
  add column if not exists stripe_connect_last_sync_at timestamptz;

-- usuń stare awaryjne triggery, jeśli kiedyś wróciły z backupu
DROP TRIGGER IF EXISTS lock_smilhytv_stripe_connected_trigger ON public.profiles;
DROP TRIGGER IF EXISTS lock_smilhytv_user_stripe_connected_trigger ON public.user_stripe_accounts;
DROP FUNCTION IF EXISTS public.lock_smilhytv_stripe_connected();
DROP FUNCTION IF EXISTS public.lock_smilhytv_user_stripe_connected();
DROP TRIGGER IF EXISTS betai_sync_user_stripe_accounts_v41 ON public.user_stripe_accounts;
DROP TRIGGER IF EXISTS betai_sync_connect_profile_v4 ON public.typer_stripe_accounts;

analyze public.user_stripe_accounts;
analyze public.profiles;

select 'OK - Wersja 6 Stripe Connect safe schema ready' as status;
