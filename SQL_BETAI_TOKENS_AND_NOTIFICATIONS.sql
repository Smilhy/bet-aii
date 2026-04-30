-- BetAI real tokens + notifications
create extension if not exists pgcrypto;

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
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

create index if not exists betai_system_notifications_recipient_idx
  on public.betai_system_notifications(recipient_email, created_at desc);

alter table public.betai_token_wallets enable row level security;
alter table public.betai_system_notifications enable row level security;

drop policy if exists "wallet select own or admin" on public.betai_token_wallets;
create policy "wallet select own or admin"
on public.betai_token_wallets
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "wallet update own or admin" on public.betai_token_wallets;
create policy "wallet update own or admin"
on public.betai_token_wallets
for update
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "wallet insert own or admin" on public.betai_token_wallets;
create policy "wallet insert own or admin"
on public.betai_token_wallets
for insert
to authenticated
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications select own or admin" on public.betai_system_notifications;
create policy "notifications select own or admin"
on public.betai_system_notifications
for select
to authenticated
using (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications update own or admin" on public.betai_system_notifications;
create policy "notifications update own or admin"
on public.betai_system_notifications
for update
to authenticated
using (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications insert admin only" on public.betai_system_notifications;
create policy "notifications insert admin only"
on public.betai_system_notifications
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

create or replace function public.set_updated_at_betai_wallets()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_betai_wallets_updated_at on public.betai_token_wallets;
create trigger trg_betai_wallets_updated_at
before update on public.betai_token_wallets
for each row
execute function public.set_updated_at_betai_wallets();