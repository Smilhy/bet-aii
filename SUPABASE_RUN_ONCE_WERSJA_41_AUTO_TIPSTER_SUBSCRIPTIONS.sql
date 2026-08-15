-- BET+AI WERSJA 41 — AUTO zapis dostępu po płatności Stripe Connect
-- Uruchom raz w Supabase SQL Editor.
-- Cel: po zakupie subskrypcji profilu webhook/sync zapisuje dostęp w tipster_subscriptions.

create extension if not exists pgcrypto;

create table if not exists public.tipster_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  buyer_id uuid,
  tipster_id uuid,
  plan text,
  plan_key text,
  duration_days integer,
  price numeric(12,2) default 0,
  platform_fee numeric(12,2) default 0,
  tipster_amount numeric(12,2) default 0,
  stripe_session_id text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz
);

alter table public.tipster_subscriptions
  add column if not exists user_id uuid,
  add column if not exists buyer_id uuid,
  add column if not exists tipster_id uuid,
  add column if not exists plan text,
  add column if not exists plan_key text,
  add column if not exists duration_days integer,
  add column if not exists price numeric(12,2) default 0,
  add column if not exists platform_fee numeric(12,2) default 0,
  add column if not exists tipster_amount numeric(12,2) default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists expires_at timestamptz;

update public.tipster_subscriptions set user_id = buyer_id where user_id is null and buyer_id is not null;
update public.tipster_subscriptions set buyer_id = user_id where buyer_id is null and user_id is not null;

create unique index if not exists uniq_tipster_sub_user_tipster
  on public.tipster_subscriptions(user_id, tipster_id);

create unique index if not exists uniq_tipster_sub_stripe_session
  on public.tipster_subscriptions(stripe_session_id)
  where stripe_session_id is not null;

create index if not exists idx_tipster_sub_user on public.tipster_subscriptions(user_id);
create index if not exists idx_tipster_sub_buyer on public.tipster_subscriptions(buyer_id);
create index if not exists idx_tipster_sub_tipster on public.tipster_subscriptions(tipster_id);
create index if not exists idx_tipster_sub_active_expiry on public.tipster_subscriptions(status, expires_at);

alter table public.tipster_subscriptions enable row level security;

drop policy if exists "tipster_subscriptions_select_own" on public.tipster_subscriptions;
create policy "tipster_subscriptions_select_own"
on public.tipster_subscriptions
for select
to authenticated
using (user_id = auth.uid() or buyer_id = auth.uid() or tipster_id = auth.uid());

drop policy if exists "tipster_subscriptions_insert_own" on public.tipster_subscriptions;
create policy "tipster_subscriptions_insert_own"
on public.tipster_subscriptions
for insert
to authenticated
with check (user_id = auth.uid() or buyer_id = auth.uid());

drop policy if exists "tipster_subscriptions_update_own" on public.tipster_subscriptions;
create policy "tipster_subscriptions_update_own"
on public.tipster_subscriptions
for update
to authenticated
using (user_id = auth.uid() or buyer_id = auth.uid() or tipster_id = auth.uid())
with check (user_id = auth.uid() or buyer_id = auth.uid() or tipster_id = auth.uid());

grant select, insert, update on public.tipster_subscriptions to authenticated;
grant all on public.tipster_subscriptions to service_role;

-- Opcjonalna kontrola:
select 'tipster_subscriptions OK' as status;
