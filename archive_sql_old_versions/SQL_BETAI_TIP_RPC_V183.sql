-- =========================================
-- BETAI TIP SYSTEM V183 ULTRA FIX
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
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
  sender_id uuid null references auth.users(id) on delete set null,
  receiver_id uuid null references auth.users(id) on delete set null,
  sender_email text null,
  receiver_email text null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.betai_token_wallets add column if not exists user_id uuid null;
alter table public.betai_token_wallets add column if not exists created_at timestamptz not null default now();
alter table public.betai_token_wallets add column if not exists updated_at timestamptz not null default now();
alter table public.betai_token_transactions add column if not exists ref_type text null;
alter table public.betai_token_transactions add column if not exists ref_data jsonb null;
alter table public.betai_system_notifications add column if not exists reward_tokens integer not null default 0;
alter table public.betai_system_notifications add column if not exists is_read boolean not null default false;
alter table public.betai_system_notifications add column if not exists sent_by text not null default 'betai';
alter table public.direct_messages add column if not exists sender_id uuid null;
alter table public.direct_messages add column if not exists receiver_id uuid null;
alter table public.direct_messages add column if not exists sender_email text null;
alter table public.direct_messages add column if not exists receiver_email text null;

alter table public.profiles disable row level security;
alter table public.betai_token_wallets disable row level security;
alter table public.betai_token_transactions disable row level security;
alter table public.betai_system_notifications disable row level security;
alter table public.direct_messages disable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;

  insert into public.betai_token_wallets (email, user_id, balance, created_at, updated_at)
  values (lower(new.email), new.id, 100, now(), now())
  on conflict (email) do update
    set user_id = excluded.user_id,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

update public.betai_token_wallets w
set user_id = u.id,
    updated_at = now()
from auth.users u
where lower(u.email) = lower(w.email)
  and (w.user_id is null or w.user_id is distinct from u.id);

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

  insert into public.betai_token_wallets(email, user_id, balance, created_at, updated_at)
  values (v_email, v_user_id, 0, now(), now())
  on conflict (email) do update
    set user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
        updated_at = now();
end;
$$;

create or replace function public._betai_tip_core(p_sender_email text, p_receiver_email text, p_amount integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email text;
  v_receiver_email text;
  v_amount integer;
  v_sender_balance integer;
  v_sender_id uuid;
  v_receiver_id uuid;
begin
  v_sender_email := lower(trim(coalesce(p_sender_email, '')));
  v_receiver_email := lower(trim(coalesce(p_receiver_email, '')));
  v_amount := coalesce(p_amount, 0);

  if v_sender_email = '' then
    return json_build_object('ok', false, 'success', false, 'error', 'not_authenticated');
  end if;
  if v_receiver_email = '' then
    return json_build_object('ok', false, 'success', false, 'error', 'receiver_missing');
  end if;
  if v_sender_email = v_receiver_email then
    return json_build_object('ok', false, 'success', false, 'error', 'cannot_tip_yourself');
  end if;
  if v_amount <= 0 then
    return json_build_object('ok', false, 'success', false, 'error', 'invalid_amount');
  end if;

  perform public.ensure_wallet_for_email(v_sender_email);
  perform public.ensure_wallet_for_email(v_receiver_email);

  select id into v_sender_id from auth.users where lower(email) = v_sender_email limit 1;
  select id into v_receiver_id from auth.users where lower(email) = v_receiver_email limit 1;

  select balance into v_sender_balance
  from public.betai_token_wallets
  where lower(email) = v_sender_email
  for update;

  if v_sender_balance is null then
    return json_build_object('ok', false, 'success', false, 'error', 'sender_wallet_missing');
  end if;
  if v_sender_balance < v_amount then
    return json_build_object('ok', false, 'success', false, 'error', 'insufficient_tokens', 'balance', v_sender_balance);
  end if;

  update public.betai_token_wallets
  set balance = balance - v_amount,
      user_id = coalesce(user_id, v_sender_id),
      updated_at = now()
  where lower(email) = v_sender_email;

  update public.betai_token_wallets
  set balance = balance + v_amount,
      user_id = coalesce(user_id, v_receiver_id),
      updated_at = now()
  where lower(email) = v_receiver_email;

  insert into public.betai_token_transactions(email, delta_tokens, reason, ref_type, ref_data)
  values
    (v_sender_email, -v_amount, 'tip_sent', 'tip', jsonb_build_object('to', v_receiver_email, 'amount', v_amount)),
    (v_receiver_email, v_amount, 'tip_received', 'tip', jsonb_build_object('from', v_sender_email, 'amount', v_amount));

  insert into public.betai_system_notifications(recipient_email, title, body, reward_tokens, sent_by)
  values (
    v_receiver_email,
    'Otrzymałeś napiwek',
    v_sender_email || ' wysłał Ci ' || v_amount || ' żetonów.',
    v_amount,
    v_sender_email
  );

  insert into public.direct_messages(sender_id, receiver_id, sender_email, receiver_email, message)
  values (
    v_sender_id,
    v_receiver_id,
    v_sender_email,
    v_receiver_email,
    'Wysłałem Ci napiwek: ' || v_amount || ' żetonów'
  );

  return json_build_object(
    'ok', true,
    'success', true,
    'sender_email', v_sender_email,
    'receiver_email', v_receiver_email,
    'amount', v_amount,
    'sender_balance_after', (select balance from public.betai_token_wallets where lower(email) = v_sender_email),
    'receiver_balance_after', (select balance from public.betai_token_wallets where lower(email) = v_receiver_email)
  );
end;
$$;

drop function if exists public.betai_send_tip(text,text,integer);
drop function if exists public.betai_send_tip(text,integer);
drop function if exists public.send_tip(text,text,integer);
drop function if exists public.send_tip(text,integer);

create or replace function public.betai_send_tip(p_sender_email text, p_receiver_email text, p_amount integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._betai_tip_core(p_sender_email, p_receiver_email, p_amount);
end;
$$;

create or replace function public.betai_send_tip(p_receiver_email text, p_amount integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text;
begin
  v_sender := lower(coalesce(auth.jwt() ->> 'email', auth.email(), ''));
  return public._betai_tip_core(v_sender, p_receiver_email, p_amount);
end;
$$;

create or replace function public.send_tip(sender_email text, receiver_email text, amount integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._betai_tip_core(sender_email, receiver_email, amount);
end;
$$;

create or replace function public.send_tip(p_receiver_email text, p_amount integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text;
begin
  v_sender := lower(coalesce(auth.jwt() ->> 'email', auth.email(), ''));
  return public._betai_tip_core(v_sender, p_receiver_email, p_amount);
end;
$$;

grant execute on function public.ensure_wallet_for_email(text) to authenticated, anon;
grant execute on function public.betai_send_tip(text,text,integer) to authenticated, anon;
grant execute on function public.betai_send_tip(text,integer) to authenticated, anon;
grant execute on function public.send_tip(text,text,integer) to authenticated, anon;
grant execute on function public.send_tip(text,integer) to authenticated, anon;

-- Jednorazowe wyrównanie wcześniejszych braków dla admina, jeśli trzeba.
insert into public.betai_token_wallets(email, user_id, balance, created_at, updated_at)
select lower('smilhytv@gmail.com'), u.id, 0, now(), now()
from auth.users u
where lower(u.email) = lower('smilhytv@gmail.com')
on conflict (email) do update
set user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    updated_at = now();
