-- WERSJA 597 — Stripe Connect dla każdego typera/użytkownika
-- Uruchom w Supabase SQL Editor, jeżeli tabela user_stripe_accounts nie istnieje
-- albo chcesz upewnić się, że marketplace ma gdzie zapisać stripe_account_id.

create table if not exists public.user_stripe_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_stripe_accounts enable row level security;

drop policy if exists "Users can read own stripe connect account" on public.user_stripe_accounts;
create policy "Users can read own stripe connect account"
  on public.user_stripe_accounts
  for select
  using (auth.uid() = user_id);

-- Zapisy/aktualizacje wykonuje Netlify backend przez SUPABASE_SERVICE_ROLE_KEY.

create index if not exists user_stripe_accounts_account_id_idx
  on public.user_stripe_accounts(stripe_account_id);

comment on table public.user_stripe_accounts is 'Stripe Connect konta typerów. Kupujący płaci przez platformę, Stripe dzieli: 80% typer, 20% platforma.';
