
-- supabase/version_1016_community_rewards_weekly_follow_ready.sql
-- Społeczność:
-- - nagrody społeczności zapisane w bazie,
-- - reset tygodniowy: poniedziałek 01:00,
-- - odbiór tylko raz na tydzień per user/email/reward,
-- - Coin zapisuje się w portfelu, historii i powiadomieniach.
-- Follow korzysta z istniejącej logiki tipster_follows w frontendzie.

create extension if not exists pgcrypto;

create or replace function public.betai_weekly_period_monday_1am()
returns text
language sql
stable
as $$
  select to_char((now() - interval '1 hour'), 'IYYY-IW');
$$;

create table if not exists public.community_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  reward_key text not null,
  reward_title text not null,
  reward_tokens integer not null default 1,
  period_key text not null default public.betai_weekly_period_monday_1am(),
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
  add column if not exists period_key text not null default public.betai_weekly_period_monday_1am();

update public.community_reward_claims
set email = lower(trim(coalesce(email, '')))
where email is not null;

with ranked as (
  select id,
         row_number() over (
           partition by user_id, reward_key, period_key
           order by created_at asc, id asc
         ) rn
  from public.community_reward_claims
  where user_id is not null and reward_key is not null and period_key is not null
)
delete from public.community_reward_claims c
using ranked r
where c.id = r.id and r.rn > 1;

with ranked as (
  select id,
         row_number() over (
           partition by lower(email), reward_key, period_key
           order by created_at asc, id asc
         ) rn
  from public.community_reward_claims
  where email is not null and email <> '' and reward_key is not null and period_key is not null
)
delete from public.community_reward_claims c
using ranked r
where c.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_reward_claims_user_reward_period_unique'
  ) then
    alter table public.community_reward_claims
      add constraint community_reward_claims_user_reward_period_unique
      unique (user_id, reward_key, period_key);
  end if;
exception when duplicate_object then null;
end $$;

create unique index if not exists community_reward_claims_email_reward_period_uidx
on public.community_reward_claims (lower(email), reward_key, period_key)
where email is not null and email <> '';

alter table public.community_reward_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_reward_claims'
      and policyname='community_reward_claims_select_own_v1016'
  ) then
    create policy community_reward_claims_select_own_v1016
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
      and policyname='community_reward_claims_insert_own_v1016'
  ) then
    create policy community_reward_claims_insert_own_v1016
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
  v_period text := public.betai_weekly_period_monday_1am();
  v_claim_id uuid;
  v_existing_id uuid;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
  v_message text := coalesce(p_reward_title, 'Nagroda społeczności') || ': otrzymujesz 1 żeton.';
begin
  if v_email is null or v_email = '' then
    raise exception 'missing email';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  select id into v_existing_id
  from public.community_reward_claims
  where reward_key = p_reward_key
    and period_key = v_period
    and (user_id = p_user_id or lower(email) = v_email)
  order by created_at asc
  limit 1;

  if v_existing_id is not null then
    select coalesce(balance, 0) into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda społeczności była już odebrana w tym tygodniu.'
    );
  end if;

  insert into public.community_reward_claims (
    user_id, email, reward_key, reward_title, reward_tokens, period_key, created_at
  )
  values (
    p_user_id, v_email, p_reward_key, p_reward_title, 1, v_period, now()
  )
  on conflict (user_id, reward_key, period_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select coalesce(balance, 0) into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda społeczności była już odebrana w tym tygodniu.'
    );
  end if;

  insert into public.betai_token_wallets (
    email, user_id, balance, welcome_bonus_claimed, updated_at
  )
  values (
    v_email, p_user_id, 1, true, now()
  )
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    welcome_bonus_claimed = true,
    updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions (
    email, delta_tokens, delta_pln, reason, ref_type, ref_id, ref_data, created_at
  )
  values (
    v_email,
    1,
    0,
    'community_reward:' || p_reward_key,
    'community_reward',
    v_claim_id::text,
    jsonb_build_object(
      'reward_key', p_reward_key,
      'reward_title', p_reward_title,
      'message', v_message,
      'period_key', v_period,
      'reset_rule', 'monday_01_00'
    ),
    now()
  );

  insert into public.betai_system_notifications (
    recipient_email, title, body, message, reward_tokens, ref_type, ref_id, is_read, created_at
  )
  values (
    v_email,
    'Nagroda społeczności',
    v_message,
    v_message,
    1,
    'community_reward',
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

grant execute on function public.claim_community_reward_v1008(uuid, text, text, text) to authenticated;

select 'v1016 community rewards weekly and UI follow ready' as status;
