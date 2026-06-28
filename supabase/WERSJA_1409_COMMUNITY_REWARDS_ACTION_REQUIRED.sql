-- WERSJA 1409 — SPOŁECZNOŚĆ: NAGRODY TYLKO ZA REALNĄ AKTYWNOŚĆ
-- Wklej w Supabase SQL Editor i uruchom.
-- Cel:
-- - nagroda NIE jest darmowa co 24h,
-- - użytkownik musi wykonać akcję: wiadomość / post / komentarz / aktywność,
-- - po odebraniu nadal działa blokada 24h,
-- - waluta: coin.

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

alter table public.community_reward_claims add column if not exists email text;
alter table public.community_reward_claims add column if not exists reward_key text;
alter table public.community_reward_claims add column if not exists reward_title text;
alter table public.community_reward_claims add column if not exists reward_tokens integer not null default 1;
alter table public.community_reward_claims add column if not exists period_key text not null default to_char(now(), 'YYYY-MM-DD');
alter table public.community_reward_claims add column if not exists created_at timestamptz not null default now();

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric not null default 0,
  reason text,
  ref_type text,
  ref_id text,
  ref_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null,
  body text,
  message text,
  reward_tokens integer,
  ref_type text,
  ref_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.community_posts add column if not exists channel_key text not null default 'ogolny';

create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null default 'ogolny',
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null,
  author_name text,
  avatar_url text,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.claim_community_reward_v1409(
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
  v_message text := coalesce(p_reward_title, 'Nagroda społeczności') || ': otrzymujesz 1 coin.';
  v_next_unlock timestamptz;
  v_cutoff timestamptz := now() - interval '24 hours';
  v_posts int := 0;
  v_comments int := 0;
  v_chat int := 0;
  v_likes int := 0;
  v_total int := 0;
  v_allowed boolean := false;
  v_required_message text := 'Najpierw wykonaj akcję w społeczności, potem odbierz nagrodę.';
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
      'message', 'Nagroda była już odebrana. Wykonaj kolejną akcję po odblokowaniu.'
    );
  end if;

  select count(*)::int into v_posts
  from public.community_posts p
  where p.created_at >= v_cutoff
    and (p.author_id = p_user_id or lower(p.author_email) = v_email);

  select count(*)::int into v_comments
  from public.community_comments c
  where c.created_at >= v_cutoff
    and (c.author_id = p_user_id or lower(c.author_email) = v_email);

  select count(*)::int into v_chat
  from public.community_chat_messages m
  where m.created_at >= v_cutoff
    and (m.author_id = p_user_id or lower(m.author_email) = v_email);

  select count(*)::int into v_likes
  from public.community_posts p
  left join public.community_reactions r on r.post_id = p.id
  where p.created_at >= v_cutoff
    and (p.author_id = p_user_id or lower(p.author_email) = v_email);

  v_total := coalesce(v_posts,0) + coalesce(v_comments,0) + coalesce(v_chat,0) + coalesce(v_likes,0);

  v_allowed := case p_reward_key
    when 'daily_chat' then v_chat >= 1
    when 'daily_post' then v_posts >= 1
    when 'daily_active' then v_total >= 3
    when 'first_chat' then v_chat >= 1
    when 'first_post' then v_posts >= 1
    when 'first_comment' then v_comments >= 1
    when 'social_value' then v_likes >= 3
    else false
  end;

  if not v_allowed then
    return jsonb_build_object(
      'claimed', false,
      'already_claimed', false,
      'reward_tokens', 0,
      'new_balance', coalesce((select balance from public.betai_token_wallets where lower(email)=v_email), 0),
      'message', v_required_message,
      'activity', jsonb_build_object(
        'posts_24h', v_posts,
        'comments_24h', v_comments,
        'chat_24h', v_chat,
        'likes_24h', v_likes,
        'total_24h', v_total
      )
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
    'community_reward_action:' || p_reward_key,
    'community_reward_action',
    v_claim_id::text,
    jsonb_build_object(
      'reward_key', p_reward_key,
      'reward_title', p_reward_title,
      'message', v_message,
      'rule', 'action_required_plus_24h_lock',
      'posts_24h', v_posts,
      'comments_24h', v_comments,
      'chat_24h', v_chat,
      'likes_24h', v_likes,
      'total_24h', v_total,
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
    'community_reward_action',
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
    'rule', 'action_required_plus_24h_lock'
  );
end;
$$;

grant execute on function public.claim_community_reward_v1409(uuid, text, text, text) to authenticated;

select 'WERSJA 1409 community rewards action required ready' as status;
