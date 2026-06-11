
-- supabase/version_1003_reward_notification_and_balance_no_rollback.sql
-- Naprawia cofanie Coin po odebraniu nagrody i dodaje reward_tokens do powiadomień.

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
  v_period text := to_char(now(), 'IYYY-IW');
  v_claim_id uuid;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
  v_message text := coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.';
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
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda za to wyzwanie była już odebrana.'
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
    'reward_tokens', 1,
    'period_key', v_period,
    'new_balance', coalesce(v_new_balance, 0),
    'message', v_message
  );
end;
$$;

grant execute on function public.claim_ranking_challenge_reward(uuid, text, text, text) to authenticated;

select 'v1003 reward notification and balance no rollback fixed' as status;
