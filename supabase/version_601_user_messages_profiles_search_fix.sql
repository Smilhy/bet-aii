-- WERSJA 601 — naprawa katalogu użytkowników dla prywatnych wiadomości
-- Uruchom w Supabase SQL Editor.
-- Cel: lista zarejestrowanych użytkowników ma być widoczna i wyszukiwalna w panelu prywatnych wiadomości.

alter table if exists public.profiles enable row level security;
alter table if exists public.direct_messages enable row level security;

-- Profile: zalogowani użytkownicy mogą pobrać katalog użytkowników do prywatnych wiadomości.
drop policy if exists "profiles_auth_select_for_messages" on public.profiles;
create policy "profiles_auth_select_for_messages"
on public.profiles
for select
to authenticated
using (true);

-- Indeksy pomocnicze dla szybszego sortowania i wyszukiwania.
create index if not exists profiles_created_at_idx on public.profiles(created_at desc);
create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_email_idx on public.profiles(email);

-- Direct messages: upewnij się, że aktualne polityki istnieją.
drop policy if exists "direct_messages_select_own" on public.direct_messages;
create policy "direct_messages_select_own"
on public.direct_messages
for select
to authenticated
using (
  auth.uid() = sender_id
  or auth.uid() = receiver_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "direct_messages_insert_own" on public.direct_messages;
create policy "direct_messages_insert_own"
on public.direct_messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and auth.uid() <> receiver_id
);

drop policy if exists "direct_messages_update_receiver" on public.direct_messages;
create policy "direct_messages_update_receiver"
on public.direct_messages
for update
to authenticated
using (
  auth.uid() = receiver_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  auth.uid() = receiver_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

create index if not exists direct_messages_sender_receiver_created_idx
  on public.direct_messages(sender_id, receiver_id, created_at desc);
create index if not exists direct_messages_receiver_unread_idx
  on public.direct_messages(receiver_id, is_read, created_at desc);
create index if not exists direct_messages_created_idx
  on public.direct_messages(created_at desc);
