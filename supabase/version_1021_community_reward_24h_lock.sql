
-- supabase/version_1021_community_reward_24h_lock.sql
-- Blokada nagród społeczności:
-- - każdą nagrodę można odebrać tylko raz na 24h,
-- - nie da się spamować odbioru,
-- - Coin zapisuje się w portfelu, historii i powiadomieniach.

create extension if not exists pgcrypto;

create table if not exists public.community_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  reward_key text not null,
  reward_title text not null,
  reward_tokens integer not null default 1,
  period_key text not null default to_char(now(), 'YYYY-MM-DD'),
  created_at timestamptz not null default now()
);

alter table public.community_reward_claims
  add column if not exists email text;

alter table public.community_reward_claims
  add column if not exists reward_key text;

alter table public.community_reward_claims
  add column if not exists reward_title text;

alter table public.community_reward_claims
  add column if not exists reward_tokens integer not null default 1;

alter table public.community_reward_claims
  add column if not exists period_key text not null default to_char(now(), 'YYYY-MM-DD');

alter table public.community_reward_claims
  add column if not exists created_at timestamptz not null default now();

update public.community_reward_claims
set email = lower(trim(coalesce(email, '')))
where email is not null;

create index if not exists community_reward_claims_user_reward_created_idx
on public.community_reward_claims(user_id, reward_key, created_at desc);

create index if not exists community_reward_claims_email_reward_created_idx
on public.community_reward_claims(lower(email), reward_key, created_at desc)
where email is not null and email <> '';

alter table public.community_reward_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_reward_claims'
      and policyname='community_reward_claims_select_own_v1021'
  ) then
    create policy community_reward_claims_select_own_v1021
    on public.community_reward_claims
    for select
    using (
      auth.uid() = user_id
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_reward_claims'
      and policyname='community_reward_claims_insert_own_v1021'
  ) then
    create policy community_reward_claims_insert_own_v1021
    on public.community_reward_claims
    for insert
    with check (
      auth.uid() = user_id
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

alter table if exists public.betai_token_wallets
  add column if not exists user_id uuid;

alter table if exists public.betai_token_wallets
  add column if not exists updated_at timestamptz default now();

alter table if exists public.betai_token_transactions
  add column if not exists ref_type text;

alter table if exists public.betai_token_transactions
  add column if not exists ref_id text;

alter table if exists public.betai_token_transactions
  add column if not exists ref_data jsonb;

alter table if exists public.betai_system_notifications
  add column if not exists reward_tokens integer not null default 0;

alter table if exists public.betai_system_notifications
  add column if not exists ref_type text;

alter table if exists public.betai_system_notifications
  add column if not exists ref_id text;

create or replace function public.claim_community_reward_v1008(
  p_user_id uuid,
  p_email text,
  p_reward_key text,
  p_reward_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_id uuid;
  v_existing_id uuid;
  v_existing_created_at timestamptz;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
  v_message text := coalesce(p_reward_title, 'Nagroda społeczności') || ': otrzymujesz 1 żeton.';
  v_next_unlock timestamptz;
begin
  if v_email is null or v_email = '' then
    raise exception 'missing email';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  select id, created_at
    into v_existing_id, v_existing_created_at
  from public.community_reward_claims
  where reward_key = p_reward_key
    and created_at > now() - interval '24 hours'
    and (
      user_id = p_user_id
      or lower(email) = v_email
    )
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    v_next_unlock := v_existing_created_at + interval '24 hours';

    select coalesce(balance, 0)
      into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'new_balance', coalesce(v_new_balance, 0),
      'next_unlock_at', v_next_unlock,
      'message', 'Nagroda społeczności była już odebrana. Kolejny odbiór po 24h.'
    );
  end if;

  insert into public.community_reward_claims (
    user_id,
    email,
    reward_key,
    reward_title,
    reward_tokens,
    period_key,
    created_at
  )
  values (
    p_user_id,
    v_email,
    p_reward_key,
    p_reward_title,
    1,
    to_char(now(), 'YYYY-MM-DD'),
    now()
  )
  returning id into v_claim_id;

  insert into public.betai_token_wallets (
    email,
    user_id,
    balance,
    welcome_bonus_claimed,
    updated_at
  )
  values (
    v_email,
    p_user_id,
    1,
    true,
    now()
  )
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    welcome_bonus_claimed = true,
    updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions (
    email,
    delta_tokens,
    delta_pln,
    reason,
    ref_type,
    ref_id,
    ref_data,
    created_at
  )
  values (
    v_email,
    1,
    0,
    'community_reward_24h:' || p_reward_key,
    'community_reward_24h',
    v_claim_id::text,
    jsonb_build_object(
      'reward_key', p_reward_key,
      'reward_title', p_reward_title,
      'message', v_message,
      'lock_rule', 'once_per_24h',
      'next_unlock_at', now() + interval '24 hours'
    ),
    now()
  );

  insert into public.betai_system_notifications (
    recipient_email,
    title,
    body,
    message,
    reward_tokens,
    ref_type,
    ref_id,
    is_read,
    created_at
  )
  values (
    v_email,
    'Nagroda społeczności',
    v_message,
    v_message,
    1,
    'community_reward_24h',
    v_claim_id::text,
    false,
    now()
  );

  return jsonb_build_object(
    'claimed', true,
    'already_claimed', false,
    'reward_tokens', 1,
    'new_balance', coalesce(v_new_balance, 0),
    'next_unlock_at', now() + interval '24 hours',
    'message', v_message,
    'lock_rule', 'once_per_24h'
  );
end;
$$;

grant execute on function public.claim_community_reward_v1008(uuid, text, text, text) to authenticated;

select 'v1021 community reward 24h lock ready' as status;
