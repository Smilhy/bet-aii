-- WERSJA 1435 — MISJE AKTYWNOŚCI: UI TYLKO PO REALNEJ WERYFIKACJI
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - frontend ma wygaszać misje, dopóki baza nie potwierdzi realnej akcji,
-- - przyciski "Odbierz +1" aktywują się dopiero gdy Supabase zwróci done=true,
-- - nadal obowiązuje blokada: 1 odbiór danej misji / 24h.
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

drop function if exists public.get_community_daily_missions_v1435(uuid, text);

create function public.get_community_daily_missions_v1435(
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
  v_total_count integer := 0;

  v_daily_chat_claimed boolean := false;
  v_daily_post_claimed boolean := false;
  v_daily_active_claimed boolean := false;
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
    and (
      m.author_id = p_user_id
      or lower(coalesce(m.author_email, '')) = v_email
    );

  select count(*)::integer
    into v_post_count
  from public.community_posts p
  where p.created_at >= v_cutoff
    and (
      p.author_id = p_user_id
      or lower(coalesce(p.author_email, '')) = v_email
    );

  select count(*)::integer
    into v_comment_count
  from public.community_comments c
  where c.created_at >= v_cutoff
    and (
      c.author_id = p_user_id
      or lower(coalesce(c.author_email, '')) = v_email
    );

  v_total_count := coalesce(v_chat_count, 0) + coalesce(v_post_count, 0) + coalesce(v_comment_count, 0);

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

  return jsonb_build_object(
    'daily_chat', jsonb_build_object(
      'count', coalesce(v_chat_count, 0),
      'target', 1,
      'done', coalesce(v_chat_count, 0) >= 1,
      'claimed', coalesce(v_daily_chat_claimed, false)
    ),
    'daily_post', jsonb_build_object(
      'count', coalesce(v_post_count, 0),
      'target', 1,
      'done', coalesce(v_post_count, 0) >= 1,
      'claimed', coalesce(v_daily_post_claimed, false)
    ),
    'daily_active', jsonb_build_object(
      'count', coalesce(v_total_count, 0),
      'target', 3,
      'done', coalesce(v_total_count, 0) >= 3,
      'claimed', coalesce(v_daily_active_claimed, false)
    )
  );
end;
$$;

grant execute on function public.get_community_daily_missions_v1435(uuid, text) to authenticated;

notify pgrst, 'reload schema';

select 'WERSJA 1435 verified community missions UI ready' as status;
