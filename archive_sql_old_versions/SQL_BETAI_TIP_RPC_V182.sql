-- =========================================
-- BETAI TIP RPC V182 - FINAL FIX
-- Wklej całość do Supabase SQL Editor i uruchom.
-- Ten skrypt:
-- 1) tworzy/naprawia funkcję betai_send_tip
-- 2) ustawia send_tip jako wrapper do tej samej logiki
-- 3) zapewnia portfele dla istniejących i nowych userów
-- 4) zapisuje transfer atomowo: odejmij + dodaj + historia + powiadomienie + DM
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_wallet_pln (
  email text primary key,
  user_id uuid null,
  balance_pln numeric(12,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null,
  body text not null,
  reward_tokens integer not null default 0,
  is_read boolean not null default false,
  sent_by text not null default 'betai',
  created_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric(12,3) not null default 0,
  reason text not null default 'system',
  ref_type text not null default 'system',
  ref_data jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid null references auth.users(id) on delete set null,
  receiver_id uuid null references auth.users(id) on delete set null,
  message_text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.betai_token_wallets add column if not exists user_id uuid null;
alter table public.betai_token_wallets add column if not exists balance integer not null default 0;
alter table public.betai_token_wallets add column if not exists welcome_bonus_claimed boolean not null default false;
alter table public.betai_token_wallets add column if not exists created_at timestamptz not null default now();
alter table public.betai_token_wallets add column if not exists updated_at timestamptz not null default now();

alter table public.betai_system_notifications add column if not exists reward_tokens integer not null default 0;
alter table public.betai_system_notifications add column if not exists is_read boolean not null default false;
alter table public.betai_system_notifications add column if not exists sent_by text not null default 'betai';

alter table public.betai_token_transactions add column if not exists delta_pln numeric(12,3) not null default 0;
alter table public.betai_token_transactions add column if not exists ref_type text not null default 'system';
alter table public.betai_token_transactions add column if not exists ref_data jsonb null;

alter table public.betai_wallet_pln add column if not exists user_id uuid null;
alter table public.betai_wallet_pln add column if not exists balance_pln numeric(12,3) not null default 0;
alter table public.betai_wallet_pln add column if not exists created_at timestamptz not null default now();
alter table public.betai_wallet_pln add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;
alter table public.betai_token_wallets enable row level security;
alter table public.betai_wallet_pln enable row level security;
alter table public.betai_system_notifications enable row level security;
alter table public.betai_token_transactions enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
for select to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "token wallet select own or admin" on public.betai_token_wallets;
create policy "token wallet select own or admin" on public.betai_token_wallets
for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "token wallet upsert own or admin" on public.betai_token_wallets;
create policy "token wallet upsert own or admin" on public.betai_token_wallets
for all to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "wallet insert own or admin" on public.betai_wallet_pln;
create policy "wallet insert own or admin" on public.betai_wallet_pln
for all to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications select own or admin" on public.betai_system_notifications;
create policy "notifications select own or admin" on public.betai_system_notifications
for select to authenticated
using (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "notifications update own or admin" on public.betai_system_notifications;
create policy "notifications update own or admin" on public.betai_system_notifications
for update to authenticated
using (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "transactions select own or admin" on public.betai_token_transactions;
create policy "transactions select own or admin" on public.betai_token_transactions
for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "dm_select_own" on public.direct_messages;
create policy "dm_select_own" on public.direct_messages
for select to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "dm_insert_own" on public.direct_messages;
create policy "dm_insert_own" on public.direct_messages
for insert to authenticated
with check (auth.uid() = sender_id);

create or replace function public.betai_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_betai_token_wallets_updated on public.betai_token_wallets;
create trigger trg_betai_token_wallets_updated
before update on public.betai_token_wallets
for each row execute function public.betai_touch_updated_at();

drop trigger if exists trg_betai_wallet_pln_updated on public.betai_wallet_pln;
create trigger trg_betai_wallet_pln_updated
before update on public.betai_wallet_pln
for each row execute function public.betai_touch_updated_at();

create or replace function public.betai_handle_new_user_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;

  insert into public.betai_token_wallets (email, user_id, balance, welcome_bonus_claimed)
  values (lower(new.email), new.id, 0, true)
  on conflict (email) do update set user_id = excluded.user_id;

  insert into public.betai_wallet_pln (email, user_id, balance_pln)
  values (lower(new.email), new.id, 0)
  on conflict (email) do update set user_id = excluded.user_id;

  return new;
end;
$$;

drop trigger if exists trg_betai_handle_new_user_setup on auth.users;
create trigger trg_betai_handle_new_user_setup
after insert on auth.users
for each row execute function public.betai_handle_new_user_setup();

insert into public.profiles (id, email)
select u.id, lower(u.email)
from auth.users u
where u.email is not null
on conflict (id) do update set email = excluded.email;

insert into public.betai_token_wallets (email, user_id, balance, welcome_bonus_claimed)
select lower(u.email), u.id, coalesce(w.balance, 0), true
from auth.users u
left join public.betai_token_wallets w on lower(w.email) = lower(u.email)
where u.email is not null
on conflict (email) do update set user_id = excluded.user_id;

insert into public.betai_wallet_pln (email, user_id, balance_pln)
select lower(u.email), u.id, coalesce(p.balance_pln, 0)
from auth.users u
left join public.betai_wallet_pln p on lower(p.email) = lower(u.email)
where u.email is not null
on conflict (email) do update set user_id = excluded.user_id;

create or replace function public.betai_send_tip(p_receiver_email text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_sender_id uuid := auth.uid();
  v_receiver_email text := lower(trim(coalesce(p_receiver_email, '')));
  v_receiver_id uuid;
  v_amount integer := floor(greatest(coalesce(p_amount, 0), 0));
  v_sender_balance integer := 0;
  v_receiver_balance integer := 0;
begin
  if v_sender_id is null or v_sender_email = '' then
    raise exception 'not_authenticated';
  end if;

  if v_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  if v_receiver_email = '' then
    raise exception 'receiver_missing';
  end if;

  if v_receiver_email = v_sender_email then
    raise exception 'cannot_tip_yourself';
  end if;

  insert into public.profiles (id, email)
  select id, lower(email)
  from auth.users
  where lower(email) = v_receiver_email
  on conflict (id) do update set email = excluded.email;

  select id into v_receiver_id
  from public.profiles
  where lower(email) = v_receiver_email
  limit 1;

  if v_receiver_id is null then
    raise exception 'receiver_not_found';
  end if;

  insert into public.betai_token_wallets (email, user_id, balance, welcome_bonus_claimed)
  values (v_sender_email, v_sender_id, 0, true)
  on conflict (email) do update set user_id = excluded.user_id;

  insert into public.betai_token_wallets (email, user_id, balance, welcome_bonus_claimed)
  values (v_receiver_email, v_receiver_id, 0, true)
  on conflict (email) do update set user_id = excluded.user_id;

  select balance into v_sender_balance
  from public.betai_token_wallets
  where lower(email) = v_sender_email
  for update;

  select balance into v_receiver_balance
  from public.betai_token_wallets
  where lower(email) = v_receiver_email
  for update;

  v_sender_balance := coalesce(v_sender_balance, 0);
  v_receiver_balance := coalesce(v_receiver_balance, 0);

  if v_sender_balance < v_amount then
    raise exception 'insufficient_tokens';
  end if;

  update public.betai_token_wallets
  set balance = v_sender_balance - v_amount,
      user_id = coalesce(user_id, v_sender_id),
      updated_at = now()
  where lower(email) = v_sender_email;

  update public.betai_token_wallets
  set balance = v_receiver_balance + v_amount,
      user_id = coalesce(user_id, v_receiver_id),
      updated_at = now()
  where lower(email) = v_receiver_email;

  insert into public.betai_token_transactions (email, delta_tokens, delta_pln, reason, ref_type, ref_data)
  values
    (v_sender_email, -v_amount, 0, 'tip_sent', 'tip', jsonb_build_object('receiver', v_receiver_email, 'amount', v_amount)),
    (v_receiver_email, v_amount, 0, 'tip_received', 'tip', jsonb_build_object('sender', v_sender_email, 'amount', v_amount));

  insert into public.betai_system_notifications (recipient_email, title, body, reward_tokens, is_read, sent_by)
  values (
    v_receiver_email,
    'Otrzymano napiwek',
    'Użytkownik ' || v_sender_email || ' wysłał Ci napiwek: ' || v_amount || ' żetonów.',
    v_amount,
    false,
    v_sender_email
  );

  insert into public.direct_messages (sender_id, receiver_id, message_text, is_read)
  values (
    v_sender_id,
    v_receiver_id,
    '💰 Otrzymałeś napiwek ' || v_amount || ' żetonów od ' || v_sender_email || '.',
    false
  );

  return jsonb_build_object(
    'ok', true,
    'sender_email', v_sender_email,
    'receiver_email', v_receiver_email,
    'amount', v_amount,
    'sender_balance_after', v_sender_balance - v_amount,
    'receiver_balance_after', v_receiver_balance + v_amount
  );
end;
$$;

drop function if exists public.send_tip(text, text, integer);
create or replace function public.send_tip(sender_email text, receiver_email text, amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email text := lower(trim(coalesce(sender_email, '')));
  v_session_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_result jsonb;
begin
  if v_sender_email = '' or v_session_email = '' or v_sender_email <> v_session_email then
    raise exception 'not_authenticated';
  end if;

  v_result := public.betai_send_tip(receiver_email, amount);
  return v_result;
end;
$$;

revoke all on function public.betai_send_tip(text, integer) from public;
revoke all on function public.send_tip(text, text, integer) from public;
grant execute on function public.betai_send_tip(text, integer) to authenticated;
grant execute on function public.send_tip(text, text, integer) to authenticated;
