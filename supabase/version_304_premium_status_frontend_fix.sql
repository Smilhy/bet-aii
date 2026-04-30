-- BetAI wersja 304 — fix statusów Premium/Admin + reset reszty na FREE
-- Uruchom w Supabase SQL Editor po wrzuceniu wersji 304.

alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists plan text default 'free';
alter table public.profiles add column if not exists subscription_status text default 'inactive';

-- 1) Wszyscy poza dwoma testowymi kontami mają być FREE
update public.profiles
set
  is_admin = false,
  is_premium = false,
  plan = 'free',
  subscription_status = 'inactive'
where lower(coalesce(email, '')) not in ('smilhytv@gmail.com', 'buchajson1988@gmail.com')
  and lower(coalesce(username, '')) not in ('smilhytv', 'buchajson1988');

-- 2) Konto admina: ADMIN + PREMIUM bez limitów
update public.profiles
set
  is_admin = true,
  is_premium = true,
  plan = 'premium',
  subscription_status = 'active'
where lower(coalesce(email, '')) = 'smilhytv@gmail.com'
   or lower(coalesce(username, '')) = 'smilhytv';

-- 3) Drugie konto testowe: PREMIUM bez admina
update public.profiles
set
  is_admin = false,
  is_premium = true,
  plan = 'premium',
  subscription_status = 'active'
where lower(coalesce(email, '')) = 'buchajson1988@gmail.com'
   or lower(coalesce(username, '')) = 'buchajson1988';

-- 4) Synchronizacja tabeli user_subscriptions, jeśli istnieje
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

insert into public.user_subscriptions (user_id, plan, status, current_period_end, cancel_at_period_end, updated_at)
select id, 'premium', 'active', now() + interval '10 years', false, now()
from public.profiles
where lower(coalesce(email, '')) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com')
   or lower(coalesce(username, '')) in ('smilhytv', 'buchajson1988')
on conflict (user_id) do update
set plan = 'premium',
    status = 'active',
    current_period_end = now() + interval '10 years',
    cancel_at_period_end = false,
    updated_at = now();

update public.user_subscriptions us
set plan = 'free', status = 'inactive', cancel_at_period_end = false, updated_at = now()
from public.profiles p
where us.user_id = p.id
  and lower(coalesce(p.email, '')) not in ('smilhytv@gmail.com', 'buchajson1988@gmail.com')
  and lower(coalesce(p.username, '')) not in ('smilhytv', 'buchajson1988');

-- 5) Podgląd końcowy
select email, username, is_admin, is_premium, plan, subscription_status
from public.profiles
where lower(coalesce(email, '')) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com')
   or lower(coalesce(username, '')) in ('smilhytv', 'buchajson1988')
order by email;
