-- WERSJA 1423 — AWARYJNIE WYŁĄCZ WOLNE POLECANE TYPERZY RPC
-- Wklej w Supabase SQL Editor i uruchom, jeśli strona długo ładuje po SQL 1421.
--
-- To NIE usuwa danych. Funkcja get_recommended_tipsters_v1421 zacznie zwracać pustą listę natychmiast.
-- Frontend 1423 już jej nie woła, ale ten SQL zabezpiecza starszą wdrożoną wersję 1421/1422.

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
    null::uuid as id,
    null::text as email,
    null::text as username,
    null::text as avatar_url,
    null::text as plan,
    null::text as subscription_status,
    false::boolean as is_premium,
    0::integer as total_tips,
    0::integer as won_tips,
    0::numeric as yield_value,
    0::numeric as profit,
    0::integer as followers_count,
    0::integer as posts_14d,
    0::integer as chat_7d,
    0::integer as recent_tips_30d,
    0::numeric as recommended_score,
    null::text as recommendation_label
  where false;
$$;

grant execute on function public.get_recommended_tipsters_v1421(integer) to anon, authenticated;

select 'WERSJA 1423 slow recommended RPC disabled' as status;
