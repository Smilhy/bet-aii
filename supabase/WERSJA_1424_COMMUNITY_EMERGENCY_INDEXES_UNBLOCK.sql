-- WERSJA 1424 — AWARYJNE ODBLOKOWANIE SPOŁECZNOŚCI / INDEKSY
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - przyspieszyć podstawowe zapytania społeczności,
-- - zabezpieczyć się przed wolnym RPC z 1421,
-- - nie usuwa żadnych danych.

create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);

create index if not exists community_posts_channel_created_idx
  on public.community_posts (channel_key, created_at desc);

create index if not exists community_posts_author_created_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists community_chat_messages_created_at_idx
  on public.community_chat_messages (created_at desc);

create index if not exists community_chat_messages_channel_created_idx
  on public.community_chat_messages (channel_key, created_at desc);

create index if not exists community_chat_messages_author_created_idx
  on public.community_chat_messages (author_id, created_at desc);

create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at asc);

create index if not exists community_reward_claims_user_created_idx
  on public.community_reward_claims (user_id, created_at desc);

create index if not exists community_reward_claims_email_created_idx
  on public.community_reward_claims (lower(email), created_at desc);

-- Neutralizacja wolnej funkcji z 1421, jeśli jakaś stara wersja frontu jeszcze ją woła.
create or replace function public.get_recommended_tipsters_v1421(p_limit integer default 5)
returns table (
  id uuid,
  email text,
  username text,
  avatar_url text,
  plan text,
  subscription_status text,
  is_premium boolean,
  total_tips integer,
  won_tips integer,
  yield_value numeric,
  profit numeric,
  followers_count integer,
  posts_14d integer,
  chat_7d integer,
  recent_tips_30d integer,
  recommended_score numeric,
  recommendation_label text
)
language sql
security definer
set search_path = public
as $$
  select
    null::uuid,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    false::boolean,
    0::integer,
    0::integer,
    0::numeric,
    0::numeric,
    0::integer,
    0::integer,
    0::integer,
    0::integer,
    0::numeric,
    null::text
  where false;
$$;

grant execute on function public.get_recommended_tipsters_v1421(integer) to anon, authenticated;

select 'WERSJA 1424 community emergency indexes and unblock ready' as status;
