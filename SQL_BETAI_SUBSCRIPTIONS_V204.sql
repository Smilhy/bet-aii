-- =========================================
-- BETAI SUBSCRIPTIONS V204
-- każdy użytkownik ustawia swoje ceny
-- każdy inny użytkownik może kupić subskrypcję
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.betai_typer_subscription_settings (
  typer_email text primary key,
  week_tokens integer not null default 0,
  month_tokens integer not null default 0,
  halfyear_tokens integer not null default 0,
  year_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.betai_typer_subscription_settings
  add column if not exists week_tokens integer not null default 0;
alter table public.betai_typer_subscription_settings
  add column if not exists month_tokens integer not null default 0;
alter table public.betai_typer_subscription_settings
  add column if not exists halfyear_tokens integer not null default 0;
alter table public.betai_typer_subscription_settings
  add column if not exists year_tokens integer not null default 0;
alter table public.betai_typer_subscription_settings
  add column if not exists created_at timestamptz not null default now();
alter table public.betai_typer_subscription_settings
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.betai_typer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  typer_email text not null,
  subscriber_email text not null,
  plan_key text not null,
  price_tokens integer not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null default now(),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(typer_email, subscriber_email)
);

alter table public.betai_typer_subscriptions
  add column if not exists created_at timestamptz not null default now();
alter table public.betai_typer_subscriptions
  add column if not exists updated_at timestamptz not null default now();

alter table public.betai_typer_subscription_settings disable row level security;
alter table public.betai_typer_subscriptions disable row level security;

grant select, insert, update on public.betai_typer_subscription_settings to anon, authenticated;
grant select, insert, update on public.betai_typer_subscriptions to anon, authenticated;

insert into public.betai_typer_subscription_settings (
  typer_email, week_tokens, month_tokens, halfyear_tokens, year_tokens, created_at, updated_at
)
select
  lower(email), 8, 22, 100, 190, now(), now()
from auth.users
where email is not null
on conflict (typer_email) do nothing;

create or replace function public.betai_seed_subscription_settings_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.betai_typer_subscription_settings (
    typer_email, week_tokens, month_tokens, halfyear_tokens, year_tokens, created_at, updated_at
  )
  values (lower(new.email), 8, 22, 100, 190, now(), now())
  on conflict (typer_email) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_betai_seed_subscription_settings on auth.users;
create trigger trg_betai_seed_subscription_settings
after insert on auth.users
for each row execute function public.betai_seed_subscription_settings_for_new_user();

create or replace view public.betai_typer_active_subscriptions as
select *
from public.betai_typer_subscriptions
where status = 'active'
  and expires_at > now();

grant select on public.betai_typer_active_subscriptions to anon, authenticated;
