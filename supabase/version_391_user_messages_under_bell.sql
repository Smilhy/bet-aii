-- BetAI v391 - prywatne Wiadomości użytkowników pod dzwonkiem
-- Uruchom w Supabase SQL Editor po wdrożeniu paczki v391.

create extension if not exists pgcrypto;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  receiver_id uuid not null,
  message_text text not null check (char_length(trim(message_text)) between 1 and 800),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_sender_receiver_created_idx
  on public.direct_messages(sender_id, receiver_id, created_at desc);

create index if not exists direct_messages_receiver_unread_idx
  on public.direct_messages(receiver_id, is_read, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "direct_messages_select_own" on public.direct_messages;
create policy "direct_messages_select_own" on public.direct_messages
for select to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "direct_messages_insert_own" on public.direct_messages;
create policy "direct_messages_insert_own" on public.direct_messages
for insert to authenticated
with check (auth.uid() = sender_id and auth.uid() <> receiver_id);

drop policy if exists "direct_messages_update_receiver" on public.direct_messages;
create policy "direct_messages_update_receiver" on public.direct_messages
for update to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

-- Lista użytkowników do wyboru rozmówcy. Jeżeli masz już własne policies dla profiles,
-- te komendy są bezpieczne: policy zostanie podmieniona na prostą wersję select dla zalogowanych.
alter table public.profiles enable row level security;

drop policy if exists "profiles_auth_select_for_messages" on public.profiles;
create policy "profiles_auth_select_for_messages" on public.profiles
for select to authenticated
using (true);

do $$
begin
  begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end;
end $$;
