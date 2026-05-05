-- WERSJA 500 - FIX: Database error saving new user
-- URUCHOM W SUPABASE SQL EDITOR: Dashboard -> SQL Editor -> New query -> wklej całość -> Run.
-- Skrypt nie usuwa użytkowników ani danych.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists wallet numeric(10,2) default 0;
alter table public.profiles add column if not exists plan text default 'free';
alter table public.profiles add column if not exists subscription_status text default 'free';
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists stripe_account_id text;
alter table public.profiles add column if not exists current_period_end timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz default now();

insert into public.profiles (
  id, email, username, public_slug, role, wallet, plan, subscription_status, is_admin, is_premium, created_at, updated_at
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'user'),
  lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'user'), '[^a-zA-Z0-9]+', '-', 'g')),
  'user',
  0,
  case when u.email = 'smilhytv@gmail.com' then 'premium' else 'free' end,
  case when u.email = 'smilhytv@gmail.com' then 'active' else 'free' end,
  case when u.email = 'smilhytv@gmail.com' then true else false end,
  case when u.email = 'smilhytv@gmail.com' then true else false end,
  now(),
  now()
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  username = coalesce(public.profiles.username, excluded.username),
  public_slug = coalesce(public.profiles.public_slug, excluded.public_slug),
  updated_at = now();

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_create_profile on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;

create or replace function public.betai_create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_slug text;
begin
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1),
    'user'
  );

  v_slug := lower(regexp_replace(v_username, '[^a-zA-Z0-9]+', '-', 'g'));

  insert into public.profiles (
    id, email, username, public_slug, role, wallet, plan, subscription_status, is_admin, is_premium, created_at, updated_at
  ) values (
    new.id,
    new.email,
    v_username,
    v_slug,
    'user',
    0,
    case when new.email = 'smilhytv@gmail.com' then 'premium' else 'free' end,
    case when new.email = 'smilhytv@gmail.com' then 'active' else 'free' end,
    case when new.email = 'smilhytv@gmail.com' then true else false end,
    case when new.email = 'smilhytv@gmail.com' then true else false end,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    public_slug = coalesce(public.profiles.public_slug, excluded.public_slug),
    updated_at = now();

  return new;
exception when others then
  -- Nie pozwalamy, żeby błąd profilu zablokował rejestrację auth.users.
  raise warning 'betai_create_profile_for_new_user failed for user %, error: %', new.id, SQLERRM;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.betai_create_profile_for_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "profiles_insert_owner" on public.profiles;
create policy "profiles_insert_owner"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

update public.profiles
set is_admin = true,
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active',
    username = coalesce(username, 'smilhytv'),
    updated_at = now()
where email = 'smilhytv@gmail.com' or username = 'smilhytv';
