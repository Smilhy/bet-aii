-- WERSJA 1436 — MISJE AKTYWNOŚCI: RESET LICZNIKÓW PO ODEBRANIU + AKTYWNY LICZY TYLKO NIEODEBRANE AKCJE
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Naprawia:
-- - odebrane misje pokazują 0/1 zamiast dalej 1/1,
-- - "Bądź aktywny" nie aktywuje się na podstawie tych samych akcji,
--   za które użytkownik już odebrał "Napisz wiadomość" albo "Dodaj post",
-- - coin nadal można odebrać tylko po realnej akcji i tylko raz na 24h.
--
-- Nie usuwa danych.

create extension if not exists pgcrypto;

create index if not exists community_reward_claims_user_reward_created_idx
  on public.community_reward_claims (user_id, reward_key, created_at desc);

create index if not exists community_reward_claims_email_reward_created_idx
  on public.community_reward_claims (lower(email), reward_key, created_at desc);

create index if not exists community_posts_author_created_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists community_posts_email_created_idx
  on public.community_posts (lower(author_email), created_at desc);

create index if not exists community_chat_messages_author_created_idx
  on public.community_chat_messages (author_id, created_at desc);

create index if not exists community_chat_messages_email_created_idx
  on public.community_chat_messages (lower(author_email), created_at desc);

create index if not exists community_comments_author_created_idx
  on public.community_comments (author_id, created_at desc);

create index if not exists community_comments_email_created_idx
  on public.community_comments (lower(author_email), created_at desc);

drop function if exists public.get_community_daily_missions_v1436(uuid, text);

create function public.get_community_daily_missions_v1436(
  p_user_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_cutoff timestamptz := now() - interval '24 hours';

  v_chat_count integer := 0;
  v_post_count integer := 0;
  v_comment_count integer := 0;

  v_daily_chat_claimed boolean := false;
  v_daily_post_claimed boolean := false;
  v_daily_active_claimed boolean := false;

  v_chat_for_active integer := 0;
  v_post_for_active integer := 0;
  v_total_for_active integer := 0;
begin
  if p_user_id is null or v_email = '' then
    return jsonb_build_object(
      'daily_chat', jsonb_build_object('count', 0, 'target', 1, 'done', false, 'claimed', false),
      'daily_post', jsonb_build_object('count', 0, 'target', 1, 'done', false, 'claimed', false),
      'daily_active', jsonb_build_object('count', 0, 'target', 3, 'done', false, 'claimed', false)
    );
  end if;

  select count(*)::integer
    into v_chat_count
  from public.community_chat_messages m
  where m.created_at >= v_cutoff
    and (m.author_id = p_user_id or lower(coalesce(m.author_email, '')) = v_email);

  select count(*)::integer
    into v_post_count
  from public.community_posts p
  where p.created_at >= v_cutoff
    and (p.author_id = p_user_id or lower(coalesce(p.author_email, '')) = v_email);

  select count(*)::integer
    into v_comment_count
  from public.community_comments c
  where c.created_at >= v_cutoff
    and (c.author_id = p_user_id or lower(coalesce(c.author_email, '')) = v_email);

  select exists (
    select 1 from public.community_reward_claims r
    where r.reward_key = 'daily_chat'
      and r.created_at >= v_cutoff
      and (r.user_id = p_user_id or lower(coalesce(r.email, '')) = v_email)
  ) into v_daily_chat_claimed;

  select exists (
    select 1 from public.community_reward_claims r
    where r.reward_key = 'daily_post'
      and r.created_at >= v_cutoff
      and (r.user_id = p_user_id or lower(coalesce(r.email, '')) = v_email)
  ) into v_daily_post_claimed;

  select exists (
    select 1 from public.community_reward_claims r
    where r.reward_key = 'daily_active'
      and r.created_at >= v_cutoff
      and (r.user_id = p_user_id or lower(coalesce(r.email, '')) = v_email)
  ) into v_daily_active_claimed;

  -- Jeśli osobna misja została odebrana, nie pokazujemy jej już jako 1/1
  -- i nie używamy tej samej akcji do odblokowania "Bądź aktywny".
  v_chat_for_active := case when v_daily_chat_claimed then 0 else coalesce(v_chat_count, 0) end;
  v_post_for_active := case when v_daily_post_claimed then 0 else coalesce(v_post_count, 0) end;
  v_total_for_active := v_chat_for_active + v_post_for_active + coalesce(v_comment_count, 0);

  return jsonb_build_object(
    'daily_chat', jsonb_build_object(
      'count', case when v_daily_chat_claimed then 0 else coalesce(v_chat_count, 0) end,
      'target', 1,
      'done', (not coalesce(v_daily_chat_claimed, false)) and coalesce(v_chat_count, 0) >= 1,
      'claimed', coalesce(v_daily_chat_claimed, false)
    ),
    'daily_post', jsonb_build_object(
      'count', case when v_daily_post_claimed then 0 else coalesce(v_post_count, 0) end,
      'target', 1,
      'done', (not coalesce(v_daily_post_claimed, false)) and coalesce(v_post_count, 0) >= 1,
      'claimed', coalesce(v_daily_post_claimed, false)
    ),
    'daily_active', jsonb_build_object(
      'count', case when v_daily_active_claimed then 0 else coalesce(v_total_for_active, 0) end,
      'target', 3,
      'done', (not coalesce(v_daily_active_claimed, false)) and coalesce(v_total_for_active, 0) >= 3,
      'claimed', coalesce(v_daily_active_claimed, false)
    )
  );
end;
$$;

grant execute on function public.get_community_daily_missions_v1436(uuid, text) to authenticated;

drop function if exists public.claim_community_reward_v1436(uuid, text, text, text);

create function public.claim_community_reward_v1436(
  p_user_id uuid,
  p_email text,
  p_reward_key text,
  p_reward_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_key text := lower(trim(coalesce(p_reward_key, '')));
  v_title text := coalesce(p_reward_title, p_reward_key);
  v_cutoff timestamptz := now() - interval '24 hours';
  v_period_key text := to_char(now(), 'YYYY-MM-DD') || ':' || v_key;
  v_recent_claim boolean := false;
  v_done boolean := false;
  v_count integer := 0;
  v_new_balance integer := 0;
  v_daily_chat_claimed boolean := false;
  v_daily_post_claimed boolean := false;
begin
  if p_user_id is null or v_email = '' or v_key = '' then
    return jsonb_build_object('claimed', false, 'message', 'Brak konta użytkownika. Zaloguj się ponownie.', 'rule', 'missing_user');
  end if;

  select exists (
    select 1
    from public.community_reward_claims c
    where c.reward_key = v_key
      and c.created_at >= v_cutoff
      and (c.user_id = p_user_id or lower(coalesce(c.email, '')) = v_email)
    limit 1
  ) into v_recent_claim;

  if v_recent_claim then
    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'message', 'Ta misja była już odebrana. Kolejny coin możesz odebrać po 24h.',
      'rule', 'one_claim_per_24h'
    );
  end if;

  if v_key = 'daily_chat' then
    select exists (
      select 1 from public.community_chat_messages m
      where m.created_at >= v_cutoff
        and (m.author_id = p_user_id or lower(coalesce(m.author_email, '')) = v_email)
      limit 1
    ) into v_done;

  elsif v_key = 'daily_post' then
    select exists (
      select 1 from public.community_posts p
      where p.created_at >= v_cutoff
        and (p.author_id = p_user_id or lower(coalesce(p.author_email, '')) = v_email)
      limit 1
    ) into v_done;

  elsif v_key = 'daily_active' then
    select exists (
      select 1 from public.community_reward_claims r
      where r.reward_key = 'daily_chat'
        and r.created_at >= v_cutoff
        and (r.user_id = p_user_id or lower(coalesce(r.email, '')) = v_email)
    ) into v_daily_chat_claimed;

    select exists (
      select 1 from public.community_reward_claims r
      where r.reward_key = 'daily_post'
        and r.created_at >= v_cutoff
        and (r.user_id = p_user_id or lower(coalesce(r.email, '')) = v_email)
    ) into v_daily_post_claimed;

    select count(*)::integer into v_count
    from (
      select id::text as id from public.community_chat_messages m
      where not coalesce(v_daily_chat_claimed, false)
        and m.created_at >= v_cutoff
        and (m.author_id = p_user_id or lower(coalesce(m.author_email, '')) = v_email)

      union all

      select id::text as id from public.community_posts p
      where not coalesce(v_daily_post_claimed, false)
        and p.created_at >= v_cutoff
        and (p.author_id = p_user_id or lower(coalesce(p.author_email, '')) = v_email)

      union all

      select id::text as id from public.community_comments c
      where c.created_at >= v_cutoff
        and (c.author_id = p_user_id or lower(coalesce(c.author_email, '')) = v_email)
    ) activity;

    v_done := coalesce(v_count, 0) >= 3;

  elsif v_key = 'first_post' then
    select exists (
      select 1 from public.community_posts p
      where p.author_id = p_user_id or lower(coalesce(p.author_email, '')) = v_email
      limit 1
    ) into v_done;

  elsif v_key = 'first_comment' then
    select exists (
      select 1 from public.community_comments c
      where c.author_id = p_user_id or lower(coalesce(c.author_email, '')) = v_email
      limit 1
    ) into v_done;

  elsif v_key = 'first_chat' then
    select exists (
      select 1 from public.community_chat_messages m
      where m.author_id = p_user_id or lower(coalesce(m.author_email, '')) = v_email
      limit 1
    ) into v_done;

  elsif v_key = 'social_value' then
    select coalesce(sum(coalesce(p.likes_count, 0)), 0)::integer
      into v_count
    from public.community_posts p
    where p.author_id = p_user_id or lower(coalesce(p.author_email, '')) = v_email;

    v_done := coalesce(v_count, 0) >= 3;

  else
    return jsonb_build_object('claimed', false, 'message', 'Nieznana misja.', 'rule', 'unknown_reward');
  end if;

  if not coalesce(v_done, false) then
    return jsonb_build_object(
      'claimed', false,
      'already_claimed', false,
      'message',
        case
          when v_key = 'daily_chat' then 'Najpierw napisz wiadomość na czacie. Dopiero potem odbierzesz coin.'
          when v_key = 'daily_post' then 'Najpierw dodaj post. Dopiero potem odbierzesz coin.'
          when v_key = 'daily_active' then 'Najpierw wykonaj łącznie 3 nieodebrane aktywności w społeczności.'
          else 'Najpierw wykonaj wymaganą akcję w społeczności.'
        end,
      'rule', 'action_required',
      'progress', coalesce(v_count, 0)
    );
  end if;

  insert into public.community_reward_claims (user_id, email, reward_key, reward_title, period_key, claimed, created_at)
  values (p_user_id, v_email, v_key, v_title, v_period_key, true, now());

  insert into public.betai_token_wallets (user_id, email, balance, updated_at)
  values (p_user_id, v_email, 1, now())
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions (user_id, email, delta_tokens, delta_pln, reason, ref_type, ref_id, created_at)
  values (p_user_id, v_email, 1, 0, 'community_reward', 'community_mission', v_key, now());

  return jsonb_build_object(
    'claimed', true,
    'already_claimed', false,
    'reward_tokens', 1,
    'new_balance', coalesce(v_new_balance, 0),
    'period_key', v_period_key,
    'message', 'Misja wykonana. Dodano +1 coin.'
  );
end;
$$;

grant execute on function public.claim_community_reward_v1436(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';

select 'WERSJA 1436 community missions reset claimed ready' as status;
