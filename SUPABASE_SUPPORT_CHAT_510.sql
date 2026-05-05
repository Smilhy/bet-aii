-- SUPABASE_SUPPORT_CHAT_510.sql
-- Live czat pomocy TypyAI.pl / Bet+AI.
-- Wiadomości użytkowników trafiają do admina: smilhytv / smilhytv@gmail.com.
-- Uruchom raz w Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  admin_email text default 'smilhytv@gmail.com',
  sender_id uuid,
  sender_email text,
  sender_name text,
  sender_role text default 'user',
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists support_messages_user_id_idx on public.support_messages(user_id);
create index if not exists support_messages_user_email_idx on public.support_messages(lower(user_email));
create index if not exists support_messages_admin_email_idx on public.support_messages(lower(admin_email));
create index if not exists support_messages_created_at_idx on public.support_messages(created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists "support select own or admin" on public.support_messages;
create policy "support select own or admin"
on public.support_messages
for select
to authenticated
using (
  auth.uid() = user_id
  or lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "support insert own or admin" on public.support_messages;
create policy "support insert own or admin"
on public.support_messages
for insert
to authenticated
with check (
  (
    sender_role = 'user'
    and auth.uid() = sender_id
    and (
      auth.uid() = user_id
      or lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and lower(coalesce(admin_email, 'smilhytv@gmail.com')) = 'smilhytv@gmail.com'
  )
  or (
    sender_role = 'admin'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
  )
);

drop policy if exists "support update admin" on public.support_messages;
create policy "support update admin"
on public.support_messages
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com');

grant select, insert, update on public.support_messages to authenticated;
