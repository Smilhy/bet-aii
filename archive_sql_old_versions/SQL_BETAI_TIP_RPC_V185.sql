-- =========================================
-- BETAI TIP SYSTEM V185 FINAL
-- Wklej całość do Supabase SQL Editor i kliknij Run
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric(12,3) not null default 0,
  reason text not null default 'system',
  ref_type text null,
  ref_data jsonb null,
  created_at timestamptz not null default now()
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

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_email text null,
  receiver_email text null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.betai_token_wallets add column if not exists user_id uuid null;
alter table public.betai_token_wallets add column if not exists welcome_bonus_claimed boolean not null default false;
alter table public.betai_token_wallets add column if not exists created_at timestamptz not null default now();
alter table public.betai_token_wallets add column if not exists updated_at timestamptz not null default now();

alter table public.betai_token_transactions add column if not exists delta_pln numeric(12,3) not null default 0;
alter table public.betai_token_transactions add column if not exists ref_type text null;
alter table public.betai_token_transactions add column if not exists ref_data jsonb null;

alter table public.betai_system_notifications add column if not exists reward_tokens integer not null default 0;
alter table public.betai_system_notifications add column if not exists is_read boolean not null default false;
alter table public.betai_system_notifications add column if not exists sent_by text not null default 'betai';

alter table public.direct_messages add column if not exists sender_email text null;
alter table public.direct_messages add column if not exists receiver_email text null;
alter table public.direct_messages add column if not exists message text;

alter table public.betai_token_wallets disable row level security;
alter table public.betai_token_transactions disable row level security;
alter table public.betai_system_notifications disable row level security;
alter table public.direct_messages disable row level security;

create or replace function public.ensure_wallet_for_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user_id uuid;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    return;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  insert into public.betai_token_wallets(email, user_id, balance, welcome_bonus_claimed, created_at, updated_at)
  values (v_email, v_user_id, 0, true, now(), now())
  on conflict (email) do update
    set user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
        updated_at = now();
end;
$$;

update public.betai_token_wallets w
set user_id = u.id,
    updated_at = now()
from auth.users u
where lower(u.email) = lower(w.email)
  and (w.user_id is distinct from u.id or w.user_id is null);

drop function if exists public.betai_send_tip(text,text,integer);
drop function if exists public.send_tip(text,text,integer);
drop function if exists public.betai_send_tip(p_sender_email text, p_receiver_email text, p_amount integer);
drop function if exists public.send_tip(p_sender_email text, p_receiver_email text, p_amount integer);

create or replace function public.betai_send_tip(
  sender_email text,
  receiver_email text,
  amount integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email text;
  v_receiver_email text;
  v_sender_balance integer;
  v_sender_after integer;
  v_receiver_after integer;
begin
  v_sender_email := lower(trim(coalesce(sender_email, '')));
  v_receiver_email := lower(trim(coalesce(receiver_email, '')));

  if v_sender_email = '' then
    return json_build_object('success', false, 'error', 'Brak emaila nadawcy');
  end if;
  if v_receiver_email = '' then
    return json_build_object('success', false, 'error', 'Brak emaila odbiorcy');
  end if;
  if v_sender_email = v_receiver_email then
    return json_build_object('success', false, 'error', 'Nie możesz wysłać napiwku samemu sobie');
  end if;
  if amount is null or amount <= 0 then
    return json_build_object('success', false, 'error', 'Nieprawidłowa liczba żetonów');
  end if;

  perform public.ensure_wallet_for_email(v_sender_email);
  perform public.ensure_wallet_for_email(v_receiver_email);

  select balance into v_sender_balance
  from public.betai_token_wallets
  where lower(email) = v_sender_email
  for update;

  if v_sender_balance is null then
    return json_build_object('success', false, 'error', 'Portfel nadawcy nie istnieje');
  end if;

  if v_sender_balance < amount then
    return json_build_object('success', false, 'error', 'Brak żetonów w portfelu', 'balance', v_sender_balance);
  end if;

  update public.betai_token_wallets
  set balance = balance - amount,
      updated_at = now()
  where lower(email) = v_sender_email;

  update public.betai_token_wallets
  set balance = balance + amount,
      updated_at = now()
  where lower(email) = v_receiver_email;

  select balance into v_sender_after from public.betai_token_wallets where lower(email) = v_sender_email;
  select balance into v_receiver_after from public.betai_token_wallets where lower(email) = v_receiver_email;

  insert into public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_data)
  values
    (v_sender_email, -amount, 0, 'tip_sent', 'tip', jsonb_build_object('to', v_receiver_email, 'amount', amount)),
    (v_receiver_email, amount, 0, 'tip_received', 'tip', jsonb_build_object('from', v_sender_email, 'amount', amount));

  insert into public.betai_system_notifications(recipient_email, title, body, reward_tokens, sent_by)
  values (
    v_receiver_email,
    'Otrzymałeś napiwek',
    v_sender_email || ' wysłał Ci ' || amount || ' żetonów.',
    amount,
    v_sender_email
  );

  insert into public.direct_messages(sender_email, receiver_email, message)
  values (
    v_sender_email,
    v_receiver_email,
    'Wysłałem Ci napiwek: ' || amount || ' żetonów'
  );

  return json_build_object(
    'success', true,
    'ok', true,
    'amount', amount,
    'credited_amount', amount,
    'sender_email', v_sender_email,
    'receiver_email', v_receiver_email,
    'sender_balance_after', v_sender_after,
    'receiver_balance_after', v_receiver_after
  );
end;
$$;

create or replace function public.send_tip(
  sender_email text,
  receiver_email text,
  amount integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.betai_send_tip(sender_email, receiver_email, amount);
end;
$$;

grant execute on function public.ensure_wallet_for_email(text) to anon;
grant execute on function public.ensure_wallet_for_email(text) to authenticated;
grant execute on function public.betai_send_tip(text,text,integer) to anon;
grant execute on function public.betai_send_tip(text,text,integer) to authenticated;
grant execute on function public.send_tip(text,text,integer) to anon;
grant execute on function public.send_tip(text,text,integer) to authenticated;
