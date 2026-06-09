-- v1126 — REALNE AVATARY TOP TYPERZY
-- Uruchom raz w Supabase SQL Editor.
-- Ta wersja nie zgaduje po fake inicjałach. Bierze avatar z profiles, a jeśli tam pusto,
-- to z auth.users.raw_user_meta_data (avatar_url / picture / image_url), czyli z miejsca,
-- gdzie bardzo często zapisuje się avatar użytkownika po uploadzie/logowaniu.

create or replace function public.betai_public_profile_avatars_for_ui()
returns table (
  id uuid,
  email text,
  username text,
  public_slug text,
  avatar_url text,
  profile_avatar_url text,
  author_avatar_url text,
  bio text,
  description text,
  about text,
  plan text,
  subscription_status text,
  followers_count bigint,
  following_count bigint,
  rating_avg numeric,
  rating_count bigint,
  reviews_count bigint,
  imported_yield numeric,
  imported_total_tips bigint,
  imported_won_tips bigint,
  imported_lost_tips bigint,
  imported_pending_tips bigint,
  imported_total_staked numeric,
  imported_profit numeric,
  imported_avg_odds numeric,
  imported_highest_odds numeric,
  imported_tips_amount numeric,
  imported_tips_currency text,
  stats_imported_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    coalesce(to_jsonb(p)->>'email', au.email)::text as email,
    coalesce(
      nullif(to_jsonb(p)->>'username', ''),
      nullif(to_jsonb(p)->>'user_name', ''),
      nullif(to_jsonb(p)->>'display_name', ''),
      nullif(au.raw_user_meta_data->>'username', ''),
      nullif(au.raw_user_meta_data->>'name', ''),
      split_part(coalesce(to_jsonb(p)->>'email', au.email, ''), '@', 1)
    )::text as username,
    coalesce(
      nullif(to_jsonb(p)->>'public_slug', ''),
      nullif(to_jsonb(p)->>'slug', ''),
      nullif(to_jsonb(p)->>'username', ''),
      split_part(coalesce(to_jsonb(p)->>'email', au.email, ''), '@', 1)
    )::text as public_slug,
    coalesce(
      nullif(to_jsonb(p)->>'avatar_url', ''),
      nullif(to_jsonb(p)->>'profile_avatar_url', ''),
      nullif(to_jsonb(p)->>'author_avatar_url', ''),
      nullif(to_jsonb(p)->>'photo_url', ''),
      nullif(to_jsonb(p)->>'picture', ''),
      nullif(to_jsonb(p)->>'image_url', ''),
      nullif(to_jsonb(p)->>'image', ''),
      nullif(au.raw_user_meta_data->>'avatar_url', ''),
      nullif(au.raw_user_meta_data->>'picture', ''),
      nullif(au.raw_user_meta_data->>'photo_url', ''),
      nullif(au.raw_user_meta_data->>'image_url', ''),
      nullif(au.raw_user_meta_data->>'image', '')
    )::text as avatar_url,
    coalesce(
      nullif(to_jsonb(p)->>'profile_avatar_url', ''),
      nullif(to_jsonb(p)->>'avatar_url', ''),
      nullif(au.raw_user_meta_data->>'avatar_url', ''),
      nullif(au.raw_user_meta_data->>'picture', '')
    )::text as profile_avatar_url,
    coalesce(
      nullif(to_jsonb(p)->>'author_avatar_url', ''),
      nullif(to_jsonb(p)->>'avatar_url', ''),
      nullif(au.raw_user_meta_data->>'avatar_url', ''),
      nullif(au.raw_user_meta_data->>'picture', '')
    )::text as author_avatar_url,
    coalesce(to_jsonb(p)->>'bio', to_jsonb(p)->>'description', to_jsonb(p)->>'about', '')::text as bio,
    coalesce(to_jsonb(p)->>'description', to_jsonb(p)->>'bio', to_jsonb(p)->>'about', '')::text as description,
    coalesce(to_jsonb(p)->>'about', to_jsonb(p)->>'bio', to_jsonb(p)->>'description', '')::text as about,
    coalesce(to_jsonb(p)->>'plan', to_jsonb(p)->>'subscription_status', to_jsonb(p)->>'account_type', 'free')::text as plan,
    coalesce(to_jsonb(p)->>'subscription_status', to_jsonb(p)->>'plan', to_jsonb(p)->>'account_type', 'free')::text as subscription_status,
    coalesce(nullif(to_jsonb(p)->>'followers_count', '')::bigint, 0)::bigint as followers_count,
    coalesce(nullif(to_jsonb(p)->>'following_count', '')::bigint, 0)::bigint as following_count,
    coalesce(nullif(to_jsonb(p)->>'rating_avg', '')::numeric, 0)::numeric as rating_avg,
    coalesce(nullif(to_jsonb(p)->>'rating_count', '')::bigint, nullif(to_jsonb(p)->>'reviews_count', '')::bigint, 0)::bigint as rating_count,
    coalesce(nullif(to_jsonb(p)->>'reviews_count', '')::bigint, nullif(to_jsonb(p)->>'rating_count', '')::bigint, 0)::bigint as reviews_count,
    coalesce(nullif(to_jsonb(p)->>'imported_yield', '')::numeric, 0)::numeric as imported_yield,
    coalesce(nullif(to_jsonb(p)->>'imported_total_tips', '')::bigint, 0)::bigint as imported_total_tips,
    coalesce(nullif(to_jsonb(p)->>'imported_won_tips', '')::bigint, 0)::bigint as imported_won_tips,
    coalesce(nullif(to_jsonb(p)->>'imported_lost_tips', '')::bigint, 0)::bigint as imported_lost_tips,
    coalesce(nullif(to_jsonb(p)->>'imported_pending_tips', '')::bigint, 0)::bigint as imported_pending_tips,
    coalesce(nullif(to_jsonb(p)->>'imported_total_staked', '')::numeric, 0)::numeric as imported_total_staked,
    coalesce(nullif(to_jsonb(p)->>'imported_profit', '')::numeric, 0)::numeric as imported_profit,
    coalesce(nullif(to_jsonb(p)->>'imported_avg_odds', '')::numeric, 0)::numeric as imported_avg_odds,
    coalesce(nullif(to_jsonb(p)->>'imported_highest_odds', '')::numeric, 0)::numeric as imported_highest_odds,
    coalesce(nullif(to_jsonb(p)->>'imported_tips_amount', '')::numeric, 0)::numeric as imported_tips_amount,
    coalesce(to_jsonb(p)->>'imported_tips_currency', 'zł')::text as imported_tips_currency,
    nullif(to_jsonb(p)->>'stats_imported_at', '')::timestamptz as stats_imported_at,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join auth.users au on au.id = p.id
  where coalesce(to_jsonb(p)->>'username', to_jsonb(p)->>'public_slug', to_jsonb(p)->>'email', au.email, '') <> '';
$$;

grant execute on function public.betai_public_profile_avatars_for_ui() to anon;
grant execute on function public.betai_public_profile_avatars_for_ui() to authenticated;

-- Alias pod nazwę, którą wcześniej podałem w wiadomości, żeby obie wersje działały.
create or replace function public.get_public_tipster_avatars()
returns table (
  id uuid,
  email text,
  username text,
  public_slug text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.email,
    a.username,
    a.public_slug,
    a.avatar_url
  from public.betai_public_profile_avatars_for_ui() a
  where a.avatar_url is not null and trim(a.avatar_url) <> '';
$$;

grant execute on function public.get_public_tipster_avatars() to anon;
grant execute on function public.get_public_tipster_avatars() to authenticated;
