create extension if not exists pgcrypto;

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_wallet_pln (
  email text primary key,
  user_id uuid null,
  balance_pln numeric(12,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null,
  body text not null,
  reward_tokens integer not null default 0,
  is_read boolean not null default false,
  sent_by text not null default 'betai',
  created_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric(12,3) not null default 0,
  reason text not null,
  ref_type text not null default 'system',
  ref_data jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.betai_withdraw_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid null,
  amount_pln numeric(12,3) not null,
  method text not null,
  target text not null,
  status text not null default 'pending',
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists betai_notifications_recipient_idx on public.betai_system_notifications(recipient_email, created_at desc);
create index if not exists betai_transactions_email_idx on public.betai_token_transactions(email, created_at desc);
create index if not exists betai_withdraw_email_idx on public.betai_withdraw_requests(email, created_at desc);

alter table public.betai_token_wallets enable row level security;
alter table public.betai_wallet_pln enable row level security;
alter table public.betai_system_notifications enable row level security;
alter table public.betai_token_transactions enable row level security;
alter table public.betai_withdraw_requests enable row level security;

drop policy if exists "token wallet select own or admin" on public.betai_token_wallets;
create policy "token wallet select own or admin" on public.betai_token_wallets
for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "token wallet upsert own or admin" on public.betai_token_wallets;
create policy "token wallet upsert own or admin" on public.betai_token_wallets
for all to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "pln wallet select own or admin" on public.betai_wallet_pln;
create policy "pln wallet select own or admin" on public.betai_wallet_pln
for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "pln wallet upsert own or admin" on public.betai_wallet_pln;
create policy "pln wallet upsert own or admin" on public.betai_wallet_pln
for all to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications select own or admin" on public.betai_system_notifications;
create policy "notifications select own or admin" on public.betai_system_notifications
for select to authenticated
using (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications update own or admin" on public.betai_system_notifications;
create policy "notifications update own or admin" on public.betai_system_notifications
for update to authenticated
using (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications insert own or admin" on public.betai_system_notifications;
create policy "notifications insert own or admin" on public.betai_system_notifications
for insert to authenticated
with check (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "transactions select own or admin" on public.betai_token_transactions;
create policy "transactions select own or admin" on public.betai_token_transactions
for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "transactions insert own or admin" on public.betai_token_transactions;
create policy "transactions insert own or admin" on public.betai_token_transactions
for insert to authenticated
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "withdraw select own or admin" on public.betai_withdraw_requests;
create policy "withdraw select own or admin" on public.betai_withdraw_requests
for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "withdraw insert own or admin" on public.betai_withdraw_requests;
create policy "withdraw insert own or admin" on public.betai_withdraw_requests
for insert to authenticated
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "withdraw update admin only" on public.betai_withdraw_requests;
create policy "withdraw update admin only" on public.betai_withdraw_requests
for update to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

create or replace function public.betai_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_betai_token_wallets_updated on public.betai_token_wallets;
create trigger trg_betai_token_wallets_updated
before update on public.betai_token_wallets
for each row execute function public.betai_touch_updated_at();

drop trigger if exists trg_betai_wallet_pln_updated on public.betai_wallet_pln;
create trigger trg_betai_wallet_pln_updated
before update on public.betai_wallet_pln
for each row execute function public.betai_touch_updated_at();

drop trigger if exists trg_betai_withdraw_requests_updated on public.betai_withdraw_requests;
create trigger trg_betai_withdraw_requests_updated
before update on public.betai_withdraw_requests
for each row execute function public.betai_touch_updated_at();