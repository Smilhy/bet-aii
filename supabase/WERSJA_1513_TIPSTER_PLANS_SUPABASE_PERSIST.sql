-- FIX 1513 v3 — poprawka pod bazę Supabase z tipster_id UUID
-- tipster_id zostaje UUID, bo ma FK do profiles.id

create extension if not exists pgcrypto;

-- 1. Usuń wszystkie stare polityki RLS z tipster_plans
do $$
declare
  pol record;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tipster_plans'
  ) then
    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tipster_plans'
    loop
      execute format(
        'drop policy if exists %I on public.tipster_plans',
        pol.policyname
      );
    end loop;
  end if;
end $$;

-- 2. Utwórz tabelę jeśli nie istnieje
create table if not exists public.tipster_plans (
  id uuid primary key default gen_random_uuid(),
  tipster_id uuid not null references public.profiles(id) on delete cascade,
  plan_key text not null,
  label text,
  duration_days integer not null default 30,
  price numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Dodaj brakujące kolumny
alter table public.tipster_plans add column if not exists plan_key text;
alter table public.tipster_plans add column if not exists label text;
alter table public.tipster_plans add column if not exists duration_days integer not null default 30;
alter table public.tipster_plans add column if not exists price numeric not null default 0;
alter table public.tipster_plans add column if not exists active boolean not null default true;
alter table public.tipster_plans add column if not exists created_at timestamptz not null default now();
alter table public.tipster_plans add column if not exists updated_at timestamptz not null default now();

-- 4. Indeksy
create unique index if not exists tipster_plans_tipster_plan_key_uidx
  on public.tipster_plans (tipster_id, plan_key);

create index if not exists tipster_plans_tipster_active_idx
  on public.tipster_plans (tipster_id, active);

-- 5. Trigger updated_at
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

-- 6. RLS od nowa
alter table public.tipster_plans enable row level security;

create policy "tipster_plans_select_active"
on public.tipster_plans
for select
to anon, authenticated
using (active = true);

create policy "tipster_plans_owner_insert"
on public.tipster_plans
for insert
to authenticated
with check (
  tipster_id = auth.uid()
);

create policy "tipster_plans_owner_update"
on public.tipster_plans
for update
to authenticated
using (
  tipster_id = auth.uid()
)
with check (
  tipster_id = auth.uid()
);

create policy "tipster_plans_owner_delete"
on public.tipster_plans
for delete
to authenticated
using (
  tipster_id = auth.uid()
);

-- 7. Uprawnienia
grant select on public.tipster_plans to anon, authenticated;
grant insert, update, delete on public.tipster_plans to authenticated;

notify pgrst, 'reload schema';

select 'FIX 1513 v3 tipster_plans UUID SQL OK' as status;
