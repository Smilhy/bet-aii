-- BetAI subscriptions + paywall patch (wersja 95)
-- Uruchom w Supabase SQL Editor tylko jeśli kolumny/subskrypcje nie istnieją.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists plan text default 'free',
  add column if not exists subscription_status text default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz;

insert into public.profiles (id, email)
select id, email
from auth.users
where id not in (select id from public.profiles);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions
  add column if not exists status text default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

delete from public.user_subscriptions a
using public.user_subscriptions b
where a.user_id = b.user_id
and a.created_at < b.created_at;

create unique index if not exists user_subscriptions_user_id_uidx
on public.user_subscriptions(user_id);

insert into public.user_subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end)
select id, plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end
from public.profiles
where id not in (select user_id from public.user_subscriptions);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.user_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
as $$
  select coalesce((
    select plan = 'premium' and subscription_status in ('active','trialing')
    from public.profiles
    where id = uid
  ), false)
$$;
