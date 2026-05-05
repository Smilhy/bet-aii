-- SUPABASE_RUN_ONCE_FIX_REGISTER_501.sql
-- Naprawa błędu: Database error saving new user
-- Wklej całość w Supabase SQL Editor i kliknij Run.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
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
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    ),
    case
      when lower(new.email) = 'smilhytv@gmail.com' then 'admin'
      else 'user'
    end,
    case
      when lower(new.email) = 'smilhytv@gmail.com' then true
      else false
    end,
    case
      when lower(new.email) = 'smilhytv@gmail.com' then true
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
    username = coalesce(public.profiles.username, excluded.username),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    role = case
      when lower(excluded.email) = 'smilhytv@gmail.com' then 'admin'
      else public.profiles.role
    end,
    is_admin = case
      when lower(excluded.email) = 'smilhytv@gmail.com' then true
      else public.profiles.is_admin
    end,
    is_premium = case
      when lower(excluded.email) = 'smilhytv@gmail.com' then true
      else public.profiles.is_premium
    end,
    points = coalesce(public.profiles.points, excluded.points),
    tokens = coalesce(public.profiles.tokens, excluded.tokens),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

update public.profiles
set
  role = 'admin',
  is_admin = true,
  is_premium = true,
  points = greatest(coalesce(points, 0), 86),
  tokens = greatest(coalesce(tokens, 0), 86),
  updated_at = now()
where lower(email) = 'smilhytv@gmail.com';
