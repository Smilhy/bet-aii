-- BetAI v96 premium customer linking safety patch
-- Run only if your Supabase project is missing any of these columns/tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamp default now(),
  plan text default 'free',
  subscription_status text default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamp
);

alter table public.profiles
add column if not exists plan text default 'free',
add column if not exists subscription_status text default 'inactive',
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists current_period_end timestamp;

create table if not exists public.user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  plan text default 'free',
  status text default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists user_subscriptions_user_id_uidx
on public.user_subscriptions(user_id);

insert into public.profiles (id, email)
select id, email
from auth.users
where id not in (select id from public.profiles);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_stripe_customer_id on public.profiles(stripe_customer_id);
create index if not exists idx_user_subscriptions_stripe_customer_id on public.user_subscriptions(stripe_customer_id);
