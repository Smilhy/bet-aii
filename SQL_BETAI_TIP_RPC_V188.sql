-- =========================================
-- BETAI TIP SYSTEM V188 UNIVERSAL RPC FIX
-- Accepts: from_email/to_email/amount
--          sender_email/receiver_email/amount
--          p_sender_email/p_receiver_email/p_amount
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text,
  delta_tokens integer,
  reason text,
  created_at timestamptz default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text,
  title text,
  body text,
  created_at timestamptz default now()
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_email text,
  receiver_email text,
  message text,
  created_at timestamptz default now()
);

alter table public.betai_token_wallets add column if not exists user_id uuid null;
alter table public.betai_token_wallets add column if not exists created_at timestamptz default now();
alter table public.betai_token_wallets add column if not exists updated_at timestamptz default now();

alter table public.betai_token_wallets disable row level security;
alter table public.betai_token_transactions disable row level security;
alter table public.betai_system_notifications disable row level security;
alter table public.direct_messages disable row level security;

drop function if exists public.betai_send_tip(text,text,integer);
drop function if exists public.send_tip(text,text,integer);
drop function if exists public.betai_send_tip(text,text,integer,text,text,integer,text,text,integer);
drop function if exists public.send_tip(text,text,integer,text,text,integer,text,text,integer);

create or replace function public.betai_send_tip(
  from_email text default null,
  to_email text default null,
  amount integer default null,
  sender_email text default null,
  receiver_email text default null,
  p_amount integer default null,
  p_sender_email text default null,
  p_receiver_email text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text;
  v_receiver text;
  v_amount integer;
  v_sender_balance integer;
begin
  v_sender := lower(trim(coalesce(from_email, sender_email, p_sender_email, '')));
  v_receiver := lower(trim(coalesce(to_email, receiver_email, p_receiver_email, '')));
  v_amount := coalesce(amount, p_amount);

  if v_sender = '' then
    return json_build_object('success', false, 'error', 'Brak nadawcy');
  end if;

  if v_receiver = '' then
    return json_build_object('success', false, 'error', 'Brak odbiorcy');
  end if;

  if v_sender = v_receiver then
    return json_build_object('success', false, 'error', 'Nie możesz wysłać do siebie');
  end if;

  if v_amount is null or v_amount <= 0 then
    return json_build_object('success', false, 'error', 'Zła kwota');
  end if;

  insert into public.betai_token_wallets(email,balance)
  values (v_sender,0)
  on conflict (email) do nothing;

  insert into public.betai_token_wallets(email,balance)
  values (v_receiver,0)
  on conflict (email) do nothing;

  select balance into v_sender_balance
  from public.betai_token_wallets
  where email = v_sender
  for update;

  if v_sender_balance is null then
    return json_build_object('success', false, 'error', 'Brak portfela');
  end if;

  if v_sender_balance < v_amount then
    return json_build_object('success', false, 'error', 'Brak żetonów', 'balance', v_sender_balance);
  end if;

  update public.betai_token_wallets
  set balance = balance - v_amount,
      updated_at = now()
  where email = v_sender;

  update public.betai_token_wallets
  set balance = balance + v_amount,
      updated_at = now()
  where email = v_receiver;

  insert into public.betai_token_transactions(email, delta_tokens, reason)
  values
    (v_sender, -v_amount, 'tip_sent'),
    (v_receiver, v_amount, 'tip_received');

  insert into public.betai_system_notifications(recipient_email, title, body)
  values (
    v_receiver,
    'Otrzymałeś napiwek',
    v_sender || ' wysłał Ci ' || v_amount || ' żetonów'
  );

  insert into public.direct_messages(sender_email, receiver_email, message)
  values (
    v_sender,
    v_receiver,
    'Napiwek: ' || v_amount || ' żetonów'
  );

  return json_build_object(
    'success', true,
    'from_email', v_sender,
    'to_email', v_receiver,
    'amount', v_amount,
    'sender_balance_after', (select balance from public.betai_token_wallets where email=v_sender),
    'receiver_balance_after', (select balance from public.betai_token_wallets where email=v_receiver)
  );
end;
$$;

create or replace function public.send_tip(
  from_email text default null,
  to_email text default null,
  amount integer default null,
  sender_email text default null,
  receiver_email text default null,
  p_amount integer default null,
  p_sender_email text default null,
  p_receiver_email text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.betai_send_tip(
    from_email,
    to_email,
    amount,
    sender_email,
    receiver_email,
    p_amount,
    p_sender_email,
    p_receiver_email
  );
end;
$$;

grant execute on function public.betai_send_tip(text,text,integer,text,text,integer,text,text) to anon, authenticated;
grant execute on function public.send_tip(text,text,integer,text,text,integer,text,text) to anon, authenticated;
