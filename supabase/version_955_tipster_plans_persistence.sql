-- WERSJA 955 — trwały cennik subskrypcji typera
-- Uruchom w Supabase SQL Editor, jeśli tabela tipster_plans nie istnieje albo zapis cen nie działa.
-- Tabela przechowuje ceny ustawione przez właściciela profilu.

create table if not exists public.tipster_plans (
  id uuid primary key default gen_random_uuid(),
  tipster_id uuid not null references public.profiles(id) on delete cascade,
  plan_key text not null,
  label text,
  duration_days integer not null default 30,
  price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipster_id, plan_key)
);

create index if not exists tipster_plans_tipster_id_idx on public.tipster_plans(tipster_id);
create index if not exists tipster_plans_active_idx on public.tipster_plans(active);

alter table public.tipster_plans enable row level security;

-- Publiczny odczyt aktywnych cenników, żeby kupujący widział aktualne ceny.
drop policy if exists "tipster_plans_select_active" on public.tipster_plans;
create policy "tipster_plans_select_active"
on public.tipster_plans
for select
using (active = true or auth.uid() = tipster_id);

-- Właściciel profilu może dodawać swoje pakiety.
drop policy if exists "tipster_plans_insert_own" on public.tipster_plans;
create policy "tipster_plans_insert_own"
on public.tipster_plans
for insert
with check (auth.uid() = tipster_id);

-- Właściciel profilu może zmieniać tylko swój cennik.
drop policy if exists "tipster_plans_update_own" on public.tipster_plans;
create policy "tipster_plans_update_own"
on public.tipster_plans
for update
using (auth.uid() = tipster_id)
with check (auth.uid() = tipster_id);
