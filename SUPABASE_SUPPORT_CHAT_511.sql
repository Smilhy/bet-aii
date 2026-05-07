-- SUPABASE_SUPPORT_CHAT_511.sql
-- Poprawka: czat pomocy działa także na ekranie logowania.
-- Gość może wysłać wiadomość do admina, a zalogowany admin smilhytv@gmail.com widzi wszystko.

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

alter table public.support_messages add column if not exists user_id uuid;
alter table public.support_messages add column if not exists user_email text;
alter table public.support_messages add column if not exists user_name text;
alter table public.support_messages add column if not exists admin_email text default 'smilhytv@gmail.com';
alter table public.support_messages add column if not exists sender_id uuid;
alter table public.support_messages add column if not exists sender_email text;
alter table public.support_messages add column if not exists sender_name text;
alter table public.support_messages add column if not exists sender_role text default 'user';
alter table public.support_messages add column if not exists message text;
alter table public.support_messages add column if not exists is_read boolean default false;
alter table public.support_messages add column if not exists created_at timestamptz default now();

create index if not exists support_messages_user_id_idx on public.support_messages(user_id);
create index if not exists support_messages_user_email_idx on public.support_messages(lower(user_email));
create index if not exists support_messages_admin_email_idx on public.support_messages(lower(admin_email));
create index if not exists support_messages_created_at_idx on public.support_messages(created_at desc);

alter table public.support_messages enable row level security;

-- Zalogowany użytkownik widzi swoje wiadomości, admin widzi wszystkie.
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

-- Gość może tylko wysłać wiadomość do admina, nie może czytać wiadomości innych.
drop policy if exists "support guest insert to admin" on public.support_messages;
create policy "support guest insert to admin"
on public.support_messages
for insert
to anon
with check (
  sender_role = 'guest'
  and user_id is null
  and sender_id is null
  and length(coalesce(message, '')) between 1 and 1200
  and position('@' in coalesce(user_email, '')) > 1
  and lower(coalesce(admin_email, 'smilhytv@gmail.com')) = 'smilhytv@gmail.com'
);

-- Zalogowany user może pisać jako user, admin może odpowiadać.
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

grant usage on schema public to anon, authenticated;
grant insert on public.support_messages to anon;
grant select, insert, update on public.support_messages to authenticated;

-- Realtime: dodaj public.support_messages do publication supabase_realtime w Supabase.
