-- BET+AI WERSJA 684
-- FIX: Wiadomości użytkowników — pełna lista zarejestrowanych użytkowników + stabilne DM.
-- Wklej w Supabase SQL Editor i kliknij RUN.

-- 1) Upewnij się, że profiles ma podstawowe kolumny i zawiera wszystkich auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists username text,
  add column if not exists created_at timestamptz not null default now();

insert into public.profiles (id, email, username, created_at)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(lower(u.email), '@', 1)
  ),
  u.created_at
from auth.users u
on conflict (id) do update
set
  email = coalesce(public.profiles.email, excluded.email),
  username = coalesce(nullif(public.profiles.username, ''), excluded.username);

create index if not exists idx_profiles_email_lower on public.profiles (lower(email));
create index if not exists idx_profiles_username_lower on public.profiles (lower(username));

-- 2) Tabela prywatnych wiadomości.
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  message_text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_direct_messages_sender_receiver_created
on public.direct_messages (sender_id, receiver_id, created_at);

create index if not exists idx_direct_messages_receiver_read
on public.direct_messages (receiver_id, is_read);

alter table public.direct_messages enable row level security;

drop policy if exists "direct messages read own conversations v684" on public.direct_messages;
create policy "direct messages read own conversations v684"
on public.direct_messages
for select
to authenticated
using (
  auth.uid() = sender_id
  or auth.uid() = receiver_id
);

drop policy if exists "direct messages insert as sender v684" on public.direct_messages;
create policy "direct messages insert as sender v684"
on public.direct_messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
);

drop policy if exists "direct messages receiver mark read v684" on public.direct_messages;
create policy "direct messages receiver mark read v684"
on public.direct_messages
for update
to authenticated
using (
  auth.uid() = receiver_id
)
with check (
  auth.uid() = receiver_id
);

-- 3) Funkcja katalogu użytkowników.
-- Dzięki SECURITY DEFINER panel wiadomości widzi wszystkich zarejestrowanych użytkowników,
-- a nie tylko tych, których RLS profiles pozwolił odczytać.
create or replace function public.get_betai_user_directory()
returns table (
  id uuid,
  email text,
  username text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    lower(coalesce(p.email, u.email)) as email,
    coalesce(
      nullif(p.username, ''),
      nullif(u.raw_user_meta_data ->> 'username', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(lower(coalesce(p.email, u.email)), '@', 1)
    ) as username,
    coalesce(p.created_at, u.created_at) as created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id <> auth.uid()
  order by coalesce(p.created_at, u.created_at) desc;
$$;

grant execute on function public.get_betai_user_directory() to authenticated;

-- 4) Realtime/Publications:
-- W Supabase -> Database -> Publications -> supabase_realtime
-- włącz tabelę direct_messages, żeby prywatne wiadomości odświeżały się na żywo.
