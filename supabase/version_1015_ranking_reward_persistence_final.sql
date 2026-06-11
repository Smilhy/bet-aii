
-- supabase/version_1015_ranking_reward_persistence_final.sql
-- FINAL: ranking challenge rewards persist permanently in Supabase for the weekly period.
-- Fixes:
-- - claimed state survives deploys,
-- - check by user_id AND email,
-- - unique claim per challenge per weekly period,
-- - wallet balance saved in betai_token_wallets,
-- - wallet history saved in betai_token_transactions,
-- - notification saved in betai_system_notifications,
-- - reset period changes every Monday 01:00.

create extension if not exists pgcrypto;

create or replace function public.betai_weekly_period_monday_1am()
returns text
language sql
stable
as $$
  select to_char((now() - interval '1 hour'), 'IYYY-IW');
$$;

create table if not exists public.betai_ranking_challenge_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  challenge_key text not null,
  challenge_title text,
  reward_tokens integer not null default 1,
  period_key text not null default public.betai_weekly_period_monday_1am(),
  created_at timestamptz not null default now()
);

alter table public.betai_ranking_challenge_claims
  add column if not exists email text;

alter table public.betai_ranking_challenge_claims
  add column if not exists challenge_key text;

alter table public.betai_ranking_challenge_claims
  add column if not exists challenge_title text;

alter table public.betai_ranking_challenge_claims
  add column if not exists reward_tokens integer not null default 1;

alter table public.betai_ranking_challenge_claims
  add column if not exists period_key text not null default public.betai_weekly_period_monday_1am();

alter table public.betai_ranking_challenge_claims
  add column if not exists created_at timestamptz not null default now();

update public.betai_ranking_challenge_claims
set email = lower(trim(coalesce(email, '')))
where email is not null;

-- Remove exact duplicates before unique constraints.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, challenge_key, period_key
      order by created_at asc, id asc
    ) as rn
  from public.betai_ranking_challenge_claims
  where user_id is not null and challenge_key is not null and period_key is not null
)
delete from public.betai_ranking_challenge_claims c
using ranked r
where c.id = r.id and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(email), challenge_key, period_key
      order by created_at asc, id asc
    ) as rn
  from public.betai_ranking_challenge_claims
  where email is not null and email <> '' and challenge_key is not null and period_key is not null
)
delete from public.betai_ranking_challenge_claims c
using ranked r
where c.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'betai_ranking_challenge_claims_user_key_period_unique'
  ) then
    alter table public.betai_ranking_challenge_claims
      add constraint betai_ranking_challenge_claims_user_key_period_unique
      unique (user_id, challenge_key, period_key);
  end if;
exception when duplicate_object then null;
end $$;

create unique index if not exists betai_ranking_challenge_claims_email_key_period_uidx
on public.betai_ranking_challenge_claims (lower(email), challenge_key, period_key)
where email is not null and email <> '';

alter table public.betai_ranking_challenge_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'betai_ranking_challenge_claims'
      and policyname = 'ranking_challenge_claims_select_own'
  ) then
    create policy ranking_challenge_claims_select_own
    on public.betai_ranking_challenge_claims
    for select
    using (
      auth.uid() = user_id
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'betai_ranking_challenge_claims'
      and policyname = 'ranking_challenge_claims_insert_own'
  ) then
    create policy ranking_challenge_claims_insert_own
    on public.betai_ranking_challenge_claims
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

create or replace function public.claim_ranking_challenge_reward(
  p_user_id uuid,
  p_email text,
  p_challenge_key text,
  p_challenge_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := public.betai_weekly_period_monday_1am();
  v_claim_id uuid;
  v_existing_id uuid;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
  v_message text := coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.';
begin
  if v_email is null or v_email = '' then
    raise exception 'missing email';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  select id
  into v_existing_id
  from public.betai_ranking_challenge_claims
  where challenge_key = p_challenge_key
    and period_key = v_period
    and (
      user_id = p_user_id
      or lower(email) = v_email
    )
  order by created_at asc
  limit 1;

  if v_existing_id is not null then
    select coalesce(balance, 0)
    into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda za to wyzwanie była już odebrana w tym tygodniu.'
    );
  end if;

  insert into public.betai_ranking_challenge_claims (
    user_id,
    email,
    challenge_key,
    challenge_title,
    reward_tokens,
    period_key,
    created_at
  )
  values (
    p_user_id,
    v_email,
    p_challenge_key,
    p_challenge_title,
    1,
    v_period,
    now()
  )
  on conflict (user_id, challenge_key, period_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select id
    into v_claim_id
    from public.betai_ranking_challenge_claims
    where challenge_key = p_challenge_key
      and period_key = v_period
      and (
        user_id = p_user_id
        or lower(email) = v_email
      )
    order by created_at asc
    limit 1;

    select coalesce(balance, 0)
    into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda za to wyzwanie była już odebrana w tym tygodniu.'
    );
  end if;

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
    'ranking_challenge:' || p_challenge_key,
    'ranking_challenge',
    v_claim_id::text,
    jsonb_build_object(
      'challenge_key', p_challenge_key,
      'challenge_title', p_challenge_title,
      'message', v_message,
      'period_key', v_period,
      'reset_rule', 'monday_01_00'
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
    'Wyzwanie ukończone',
    v_message,
    v_message,
    1,
    'ranking_challenge',
    v_claim_id::text,
    false,
    now()
  );

  return jsonb_build_object(
    'claimed', true,
    'already_claimed', false,
    'reward_tokens', 1,
    'period_key', v_period,
    'new_balance', coalesce(v_new_balance, 0),
    'message', v_message,
    'reset_rule', 'monday_01_00'
  );
end;
$$;

grant execute on function public.claim_ranking_challenge_reward(uuid, text, text, text) to authenticated;

select 'v1015 ranking rewards persistence final ready' as status;
