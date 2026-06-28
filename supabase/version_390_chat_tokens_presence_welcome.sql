-- BetAI v390 - chat tip tokens, active users in current minute, welcome notifications
-- Run once in Supabase SQL Editor after deploying this package.

create extension if not exists pgcrypto;

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid,
  balance integer not null default 0 check (balance >= 0),
  welcome_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric not null default 0,
  reason text not null default 'activity',
  ref_type text,
  ref_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null default 'Wiadomość BetAI',
  body text,
  message text,
  reward_tokens integer not null default 0,
  sent_by text not null default 'betai',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.presence_heartbeats (
  user_id text primary key,
  email text,
  last_seen timestamptz not null default now()
);

create table if not exists public.live_chat_daily_rewards (
  reward_date date primary key,
  winner_email text not null,
  winner_name text,
  message_count integer not null default 0,
  tokens_awarded integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.betai_token_wallets enable row level security;
alter table public.betai_token_transactions enable row level security;
alter table public.betai_system_notifications enable row level security;
alter table public.presence_heartbeats enable row level security;
alter table public.live_chat_daily_rewards enable row level security;

-- App-level policies: permissive enough for chat tips to transfer 1 token between users.
drop policy if exists "betai_wallets_auth_select" on public.betai_token_wallets;
create policy "betai_wallets_auth_select" on public.betai_token_wallets for select to authenticated using (true);
drop policy if exists "betai_wallets_auth_insert" on public.betai_token_wallets;
create policy "betai_wallets_auth_insert" on public.betai_token_wallets for insert to authenticated with check (true);
drop policy if exists "betai_wallets_auth_update" on public.betai_token_wallets;
create policy "betai_wallets_auth_update" on public.betai_token_wallets for update to authenticated using (true) with check (true);

drop policy if exists "betai_transactions_auth_select" on public.betai_token_transactions;
create policy "betai_transactions_auth_select" on public.betai_token_transactions for select to authenticated using (true);
drop policy if exists "betai_transactions_auth_insert" on public.betai_token_transactions;
create policy "betai_transactions_auth_insert" on public.betai_token_transactions for insert to authenticated with check (true);

drop policy if exists "betai_notifications_auth_select" on public.betai_system_notifications;
create policy "betai_notifications_auth_select" on public.betai_system_notifications for select to authenticated using (lower(recipient_email) = lower(auth.email()) or lower(auth.email()) = 'smilhytv@gmail.com');
drop policy if exists "betai_notifications_auth_insert" on public.betai_system_notifications;
create policy "betai_notifications_auth_insert" on public.betai_system_notifications for insert to authenticated with check (true);
drop policy if exists "betai_notifications_auth_update" on public.betai_system_notifications;
create policy "betai_notifications_auth_update" on public.betai_system_notifications for update to authenticated using (lower(recipient_email) = lower(auth.email()) or lower(auth.email()) = 'smilhytv@gmail.com') with check (true);

drop policy if exists "presence_auth_select" on public.presence_heartbeats;
create policy "presence_auth_select" on public.presence_heartbeats for select to authenticated using (true);
drop policy if exists "presence_auth_insert" on public.presence_heartbeats;
create policy "presence_auth_insert" on public.presence_heartbeats for insert to authenticated with check (true);
drop policy if exists "presence_auth_update" on public.presence_heartbeats;
create policy "presence_auth_update" on public.presence_heartbeats for update to authenticated using (true) with check (true);

drop policy if exists "live_chat_daily_rewards_select" on public.live_chat_daily_rewards;
create policy "live_chat_daily_rewards_select" on public.live_chat_daily_rewards for select to authenticated using (true);
drop policy if exists "live_chat_daily_rewards_insert" on public.live_chat_daily_rewards;
create policy "live_chat_daily_rewards_insert" on public.live_chat_daily_rewards for insert to authenticated with check (true);

create index if not exists betai_token_wallets_email_idx on public.betai_token_wallets(lower(email));
create index if not exists betai_token_transactions_email_idx on public.betai_token_transactions(lower(email), created_at desc);
create index if not exists betai_system_notifications_recipient_idx on public.betai_system_notifications(lower(recipient_email), created_at desc);
create index if not exists presence_heartbeats_seen_idx on public.presence_heartbeats(last_seen desc);

-- Realtime publication (safe if already added).
do $$
begin
  begin alter publication supabase_realtime add table public.presence_heartbeats; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.betai_system_notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.betai_token_wallets; exception when duplicate_object then null; end;
end $$;
