-- FIX WERSJA 968 — trwały opis profilu / bio widoczny dla innych użytkowników
-- Poprawka błędu:
-- ERROR 42P13: cannot change return type of existing function
-- Teraz najpierw usuwamy starą funkcję public.betai_public_profiles_for_ui().

alter table public.profiles
  add column if not exists bio text,
  add column if not exists description text,
  add column if not exists about text,
  add column if not exists preferred_sport text,
  add column if not exists public_slug text,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists profiles_public_slug_unique_idx
on public.profiles(public_slug)
where public_slug is not null;

create index if not exists profiles_username_idx
on public.profiles(username);

create index if not exists profiles_email_idx
on public.profiles(email);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public_v967"
on public.profiles;

create policy "profiles_select_public_v967"
on public.profiles
for select
using (true);

drop policy if exists "profiles_insert_own_v967"
on public.profiles;

create policy "profiles_insert_own_v967"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own_v967"
on public.profiles;

create policy "profiles_update_own_v967"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop view if exists public.betai_public_profiles_for_ui_view;

drop function if exists public.betai_public_profiles_for_ui();

create function public.betai_public_profiles_for_ui()
returns table (
  id uuid,
  email text,
  username text,
  public_slug text,
  avatar_url text,
  bio text,
  description text,
  about text,
  preferred_sport text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.username,
    p.public_slug,
    p.avatar_url,
    p.bio,
    p.description,
    p.about,
    p.preferred_sport,
    p.created_at,
    p.updated_at
  from public.profiles p;
$$;

create view public.betai_public_profiles_for_ui_view as
select
  id,
  email,
  username,
  public_slug,
  avatar_url,
  bio,
  description,
  about,
  preferred_sport,
  created_at,
  updated_at
from public.profiles;

grant execute on function public.betai_public_profiles_for_ui() to anon, authenticated;
grant select on public.betai_public_profiles_for_ui_view to anon, authenticated;

create or replace function public.set_profiles_updated_at_v967()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at_v967
on public.profiles;

create trigger trg_profiles_updated_at_v967
before update on public.profiles
for each row
execute function public.set_profiles_updated_at_v967();
