-- BetAI LIVE CHAT v226/v3 - FULL LIVE FIX
-- Run this once in Supabase SQL Editor.
-- This version fixes live visibility between accounts, Realtime publication, RLS and tip notifications.

create extension if not exists pgcrypto;

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  user_name text,
  avatar_url text,
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 240),
  tipped_amount integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists live_chat_messages_created_idx on public.live_chat_messages(created_at desc);
create index if not exists live_chat_messages_email_idx on public.live_chat_messages(user_email, created_at desc);

alter table public.live_chat_messages enable row level security;

drop policy if exists "live_chat_messages_select_auth" on public.live_chat_messages;
create policy "live_chat_messages_select_auth"
on public.live_chat_messages
for select
to authenticated
using (true);

drop policy if exists "live_chat_messages_insert_auth" on public.live_chat_messages;
create policy "live_chat_messages_insert_auth"
on public.live_chat_messages
for insert
to authenticated
with check (lower(auth.email()) = lower(user_email));

drop policy if exists "live_chat_messages_update_auth" on public.live_chat_messages;
create policy "live_chat_messages_update_auth"
on public.live_chat_messages
for update
to authenticated
using (true)
with check (true);

create table if not exists public.live_chat_tips (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.live_chat_messages(id) on delete set null,
  from_email text not null,
  to_email text not null,
  amount integer not null default 1 check (amount > 0 and amount <= 10),
  created_at timestamptz not null default now()
);

create index if not exists live_chat_tips_message_idx on public.live_chat_tips(message_id, created_at desc);
create index if not exists live_chat_tips_from_idx on public.live_chat_tips(from_email, created_at desc);
create index if not exists live_chat_tips_to_idx on public.live_chat_tips(to_email, created_at desc);

alter table public.live_chat_tips enable row level security;

drop policy if exists "live_chat_tips_select_auth" on public.live_chat_tips;
create policy "live_chat_tips_select_auth"
on public.live_chat_tips
for select
to authenticated
using (true);

drop policy if exists "live_chat_tips_insert_auth" on public.live_chat_tips;
create policy "live_chat_tips_insert_auth"
on public.live_chat_tips
for insert
to authenticated
with check (lower(auth.email()) = lower(from_email));

create table if not exists public.live_chat_daily_rewards (
  reward_date date primary key,
  winner_email text not null,
  winner_name text,
  message_count integer not null default 0,
  tokens_awarded integer not null default 1 check (tokens_awarded >= 1 and tokens_awarded <= 1),
  created_at timestamptz not null default now()
);

alter table public.live_chat_daily_rewards enable row level security;

drop policy if exists "live_chat_rewards_select_auth" on public.live_chat_daily_rewards;
create policy "live_chat_rewards_select_auth"
on public.live_chat_daily_rewards
for select
to authenticated
using (true);

drop policy if exists "live_chat_rewards_insert_auth" on public.live_chat_daily_rewards;
create policy "live_chat_rewards_insert_auth"
on public.live_chat_daily_rewards
for insert
to authenticated
with check (true);

-- Realtime: idempotent publication setup.
do $$
begin
  begin alter publication supabase_realtime add table public.live_chat_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.live_chat_tips; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.live_chat_daily_rewards; exception when duplicate_object then null; end;
end $$;

-- Optional sanity check:
-- select * from pg_publication_tables where pubname='supabase_realtime' and tablename like 'live_chat%';
