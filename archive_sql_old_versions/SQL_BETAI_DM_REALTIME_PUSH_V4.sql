-- BETAI V4: prywatne wiadomości realtime + push/toast notifications
-- Wklej w Supabase SQL Editor i uruchom, jeżeli DM nie działa live.

create extension if not exists pgcrypto;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  receiver_id uuid not null,
  message_text text not null check (char_length(trim(message_text)) > 0 and char_length(message_text) <= 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_sender_receiver_created_idx
  on public.direct_messages(sender_id, receiver_id, created_at desc);
create index if not exists direct_messages_receiver_read_idx
  on public.direct_messages(receiver_id, is_read, created_at desc);

create table if not exists public.presence_heartbeats (
  user_id uuid primary key,
  email text,
  last_seen timestamptz not null default now()
);

alter table public.direct_messages enable row level security;
alter table public.presence_heartbeats enable row level security;

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

drop policy if exists "dm_update_receiver_read" on public.direct_messages;
create policy "dm_update_receiver_read"
on public.direct_messages
for update
to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "presence_select_auth" on public.presence_heartbeats;
create policy "presence_select_auth"
on public.presence_heartbeats
for select
to authenticated
using (true);

drop policy if exists "presence_insert_own" on public.presence_heartbeats;
create policy "presence_insert_own"
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

alter table public.direct_messages replica identity full;
alter table public.presence_heartbeats replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.presence_heartbeats; exception when duplicate_object then null; end;
end $$;
