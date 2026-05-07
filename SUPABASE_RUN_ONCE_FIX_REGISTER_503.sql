-- SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql
-- Poprawiona wersja: usuwa też stary trigger trigger_create_profile,
-- który blokował DROP FUNCTION create_profile_for_new_user().
-- Uruchom raz w Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists premium_until timestamptz;
alter table public.profiles add column if not exists balance numeric default 0;
alter table public.profiles add column if not exists points integer default 0;
alter table public.profiles add column if not exists tokens integer default 0;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

-- Usuwamy wszystkie stare triggery, które mogły blokować rejestrację.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists handle_new_user on auth.users;
drop trigger if exists trigger_create_profile on auth.users;
drop trigger if exists create_profile_for_new_user on auth.users;
drop trigger if exists on_user_created on auth.users;
drop trigger if exists after_user_created on auth.users;

-- Teraz można bezpiecznie usunąć stare funkcje.
drop function if exists public.handle_new_user() cascade;
drop function if exists public.create_profile_for_new_user() cascade;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_username text;
  safe_display_name text;
begin
  safe_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  );

  safe_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  );

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    role,
    is_admin,
    is_premium,
    balance,
    points,
    tokens,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    safe_username,
    safe_display_name,
    case
      when lower(coalesce(new.email, '')) = 'smilhytv@gmail.com' then 'admin'
      else 'user'
    end,
    case
      when lower(coalesce(new.email, '')) = 'smilhytv@gmail.com' then true
      else false
    end,
    case
      when lower(coalesce(new.email, '')) = 'smilhytv@gmail.com' then true
      else false
    end,
    0,
    86,
    86,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(nullif(public.profiles.username, ''), excluded.username),
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    role = case
      when lower(coalesce(excluded.email, '')) = 'smilhytv@gmail.com' then 'admin'
      else coalesce(public.profiles.role, 'user')
    end,
    is_admin = case
      when lower(coalesce(excluded.email, '')) = 'smilhytv@gmail.com' then true
      else coalesce(public.profiles.is_admin, false)
    end,
    is_premium = case
      when lower(coalesce(excluded.email, '')) = 'smilhytv@gmail.com' then true
      else coalesce(public.profiles.is_premium, false)
    end,
    points = coalesce(public.profiles.points, excluded.points, 86),
    tokens = coalesce(public.profiles.tokens, excluded.tokens, 86),
    updated_at = now();

  return new;

exception
  when others then
    -- Nie blokuj tworzenia konta w auth.users.
    raise warning 'handle_new_user profile insert failed for user %, error: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

insert into public.profiles (
  id,
  email,
  username,
  display_name,
  role,
  is_admin,
  is_premium,
  balance,
  points,
  tokens,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'user'
  ),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'user'
  ),
  case
    when lower(coalesce(u.email, '')) = 'smilhytv@gmail.com' then 'admin'
    else 'user'
  end,
  case
    when lower(coalesce(u.email, '')) = 'smilhytv@gmail.com' then true
    else false
  end,
  case
    when lower(coalesce(u.email, '')) = 'smilhytv@gmail.com' then true
    else false
  end,
  0,
  86,
  86,
  now(),
  now()
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

update public.profiles
set
  role = 'admin',
  is_admin = true,
  is_premium = true,
  points = greatest(coalesce(points, 0), 86),
  tokens = greatest(coalesce(tokens, 0), 86),
  updated_at = now()
where lower(email) = 'smilhytv@gmail.com';
