-- WERSJA 1513 — trwały cennik subskrypcji typera w Supabase
-- Uruchom w Supabase SQL Editor, jeżeli po deployu ceny dalej wracają do domyślnych.
-- Nie usuwa danych.

create extension if not exists pgcrypto;

create table if not exists public.tipster_plans (
  id uuid primary key default gen_random_uuid(),
  tipster_id text not null,
  plan_key text not null,
  label text,
  duration_days integer not null default 30,
  price numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tipster_plans add column if not exists tipster_id text;
alter table public.tipster_plans add column if not exists plan_key text;
alter table public.tipster_plans add column if not exists label text;
alter table public.tipster_plans add column if not exists duration_days integer not null default 30;
alter table public.tipster_plans add column if not exists price numeric not null default 0;
alter table public.tipster_plans add column if not exists active boolean not null default true;
alter table public.tipster_plans add column if not exists created_at timestamptz not null default now();
alter table public.tipster_plans add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tipster_plans'
      and column_name = 'tipster_id'
      and data_type = 'uuid'
  ) then
    alter table public.tipster_plans
      alter column tipster_id type text
      using tipster_id::text;
  end if;
end $$;

create unique index if not exists tipster_plans_tipster_plan_key_uidx
  on public.tipster_plans (tipster_id, plan_key);

create index if not exists tipster_plans_tipster_active_idx
  on public.tipster_plans (tipster_id, active);

create or replace function public.touch_tipster_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tipster_plans_touch_updated_at on public.tipster_plans;

create trigger tipster_plans_touch_updated_at
before update on public.tipster_plans
for each row
execute function public.touch_tipster_plans_updated_at();

alter table public.tipster_plans enable row level security;

drop policy if exists "tipster_plans_select_all" on public.tipster_plans;

create policy "tipster_plans_select_all"
on public.tipster_plans
for select
to anon, authenticated
using (true);

drop policy if exists "tipster_plans_owner_write" on public.tipster_plans;

create policy "tipster_plans_owner_write"
on public.tipster_plans
for all
to authenticated
using (
  tipster_id = auth.uid()::text
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
)
with check (
  tipster_id = auth.uid()::text
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);

grant select on public.tipster_plans to anon, authenticated;
grant insert, update, delete on public.tipster_plans to authenticated;

notify pgrst, 'reload schema';

select 'WERSJA 1513 tipster_plans persistence ready' as status;
