-- =========================================
-- BETAI SUBSCRIPTIONS SYSTEM V203
-- Każdy użytkownik ustawia własne ceny.
-- Każdy inny użytkownik może kupić subskrypcję.
-- Zgodne z frontendem v202/v203.
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

create table if not exists public.betai_typer_subscriptions (
  typer_email text not null,
  subscriber_email text not null,
  plan_key text not null,
  price_tokens integer not null default 0,
  starts_at timestamptz null,
  expires_at timestamptz null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (typer_email, subscriber_email)
);

alter table public.betai_typer_subscription_settings disable row level security;
alter table public.betai_typer_subscriptions disable row level security;

grant select, insert, update on public.betai_typer_subscription_settings to anon, authenticated;
grant select, insert, update on public.betai_typer_subscriptions to anon, authenticated;

insert into public.betai_typer_subscription_settings (typer_email)
select lower(email)
from auth.users
where email is not null
on conflict (typer_email) do nothing;

create or replace function public.betai_create_subscription_settings_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.betai_typer_subscription_settings (typer_email)
  values (lower(new.email))
  on conflict (typer_email) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_betai_create_subscription_settings_for_user on auth.users;

create trigger trg_betai_create_subscription_settings_for_user
after insert on auth.users
for each row
execute function public.betai_create_subscription_settings_for_user();

create or replace view public.betai_active_typer_subscriptions as
select *
from public.betai_typer_subscriptions
where status = 'active'
  and (expires_at is null or expires_at > now());

grant select on public.betai_active_typer_subscriptions to anon, authenticated;
