
-- supabase/version_1001_reward_persistence_rls_fix.sql
-- Naprawa cofania Coin po odebraniu wyzwania.
-- Dodaje RLS policies do tokenów/powiadomień i zwraca new_balance z RPC.

alter table if exists public.betai_token_wallets enable row level security;
alter table if exists public.betai_token_transactions enable row level security;
alter table if exists public.betai_system_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_token_wallets'
      and policyname='token_wallets_select_own_email'
  ) then
    create policy token_wallets_select_own_email
    on public.betai_token_wallets
    for select
    using (
      lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
      or auth.uid() = user_id
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_token_transactions'
      and policyname='token_transactions_select_own_email'
  ) then
    create policy token_transactions_select_own_email
    on public.betai_token_transactions
    for select
    using (
      lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_system_notifications'
      and policyname='system_notifications_select_own_email'
  ) then
    create policy system_notifications_select_own_email
    on public.betai_system_notifications
    for select
    using (
      lower(recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_system_notifications'
      and policyname='system_notifications_update_own_email'
  ) then
    create policy system_notifications_update_own_email
    on public.betai_system_notifications
    for update
    using (
      lower(recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
    with check (
      lower(recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    );
  end if;
end $$;

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
  v_period text := to_char(now(), 'IYYY-IW');
  v_claim_id uuid;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  insert into public.betai_ranking_challenge_claims (
    user_id,
    email,
    challenge_key,
    challenge_title,
    reward_tokens,
    period_key
  )
  values (
    p_user_id,
    v_email,
    p_challenge_key,
    p_challenge_title,
    1,
    v_period
  )
  on conflict (user_id, challenge_key, period_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select coalesce(balance, 0)
    into v_new_balance
    from public.betai_token_wallets
    where email = v_email;

    return jsonb_build_object(
      'claimed', false,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0)
    );
  end if;

  insert into public.betai_token_wallets (email, user_id, balance, updated_at)
  values (v_email, p_user_id, 1, now())
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions (
    email,
    delta_tokens,
    delta_pln,
    reason,
    ref_type,
    ref_id
  )
  values (
    v_email,
    1,
    0,
    'ranking_challenge:' || p_challenge_key,
    'ranking_challenge',
    v_claim_id::text
  );

  insert into public.betai_system_notifications (
    recipient_email,
    title,
    body,
    message,
    is_read,
    created_at
  )
  values (
    v_email,
    'Wyzwanie ukończone',
    coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.',
    coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.',
    false,
    now()
  );

  return jsonb_build_object(
    'claimed', true,
    'reward_tokens', 1,
    'period_key', v_period,
    'new_balance', coalesce(v_new_balance, 0),
    'message', coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.'
  );
end;
$$;

grant execute on function public.claim_ranking_challenge_reward(uuid, text, text, text) to authenticated;

select 'v1001 reward persistence and RLS fixed' as status;
