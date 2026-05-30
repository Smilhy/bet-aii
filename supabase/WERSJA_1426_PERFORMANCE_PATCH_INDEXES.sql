-- WERSJA 1426 — PERFORMANCE PATCH / INDEKSY + BEZPIECZNE LIMITY
-- Wklej w Supabase SQL Editor i uruchom.
-- Nie usuwa danych. To tylko indeksy pod zapytania, które wykryła diagnostyka.

create index if not exists direct_messages_receiver_read_idx
  on public.direct_messages (receiver_id, is_read, created_at desc);

create index if not exists direct_messages_sender_receiver_created_idx
  on public.direct_messages (sender_id, receiver_id, created_at desc);

create index if not exists direct_messages_receiver_sender_created_idx
  on public.direct_messages (receiver_id, sender_id, created_at desc);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);

create index if not exists community_posts_channel_created_idx
  on public.community_posts (channel_key, created_at desc);

create index if not exists community_chat_messages_created_at_idx
  on public.community_chat_messages (created_at desc);

create index if not exists community_chat_messages_channel_created_idx
  on public.community_chat_messages (channel_key, created_at desc);

create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at asc);

-- Zostawiamy wolną funkcję z 1421 jako natychmiast pustą, żeby żadna stara paczka nie mieliła bazy.
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

select 'WERSJA 1426 performance patch ready' as status;
