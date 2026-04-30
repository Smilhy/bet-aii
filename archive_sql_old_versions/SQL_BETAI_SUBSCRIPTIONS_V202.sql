-- =========================================
-- BETAI SUBSCRIPTIONS LIVE V202
-- każdy użytkownik ustawia własne ceny
-- każdy użytkownik może kupić subskrypcję innego typera
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.betai_typer_subscription_settings (
  typer_email text primary key,
  week_tokens integer not null default 8,
  month_tokens integer not null default 22,
  halfyear_tokens integer not null default 100,
  year_tokens integer not null default 190,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_typer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  typer_email text not null,
  subscriber_email text not null,
  plan_key text not null,
  price_tokens integer not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (typer_email, subscriber_email)
);

alter table public.betai_typer_subscription_settings disable row level security;
alter table public.betai_typer_subscriptions disable row level security;

grant select, insert, update on public.betai_typer_subscription_settings to anon, authenticated;
grant select, insert, update on public.betai_typer_subscriptions to anon, authenticated;
