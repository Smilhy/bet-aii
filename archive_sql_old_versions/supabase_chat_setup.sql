-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  message_text text not null check (char_length(message_text) > 0),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_receiver_idx on public.direct_messages(receiver_id, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "dm_select_own" on public.direct_messages;
create policy "dm_select_own"
on public.direct_messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "dm_insert_own" on public.direct_messages;
create policy "dm_insert_own"
on public.direct_messages
for insert
to authenticated
with check (auth.uid() = sender_id);

drop policy if exists "dm_update_receiver" on public.direct_messages;
create policy "dm_update_receiver"
on public.direct_messages
for update
to authenticated
using (auth.uid() = receiver_id or auth.uid() = sender_id)
with check (auth.uid() = receiver_id or auth.uid() = sender_id);

-- profiles table should already exist in your app, but run this if needed:
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- presence table should already exist in your app, but run this if needed:
create table if not exists public.presence_heartbeats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  last_seen timestamptz not null default now()
);

alter table public.presence_heartbeats enable row level security;

drop policy if exists "presence_select_authenticated" on public.presence_heartbeats;
create policy "presence_select_authenticated"
on public.presence_heartbeats
for select
to authenticated
using (true);

drop policy if exists "presence_upsert_own" on public.presence_heartbeats;
create policy "presence_upsert_own"
on public.presence_heartbeats
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "presence_update_own" on public.presence_heartbeats;
create policy "presence_update_own"
on public.presence_heartbeats
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);