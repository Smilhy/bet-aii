-- v1125 — publiczne avatary do Top typerów
-- Uruchom raz w Supabase SQL Editor.
-- Funkcja jest SECURITY DEFINER, żeby Top typerzy mogli pobrać publiczne avatary profili mimo RLS.

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
set search_path = public
as $$
  select
    p.id,
    p.email::text,
    p.username::text,
    p.public_slug::text,
    p.avatar_url::text,
    p.avatar_url::text as profile_avatar_url,
    p.avatar_url::text as author_avatar_url,
    p.bio::text,
    p.description::text,
    p.about::text,
    p.plan::text,
    p.subscription_status::text,
    coalesce(p.followers_count, 0)::bigint,
    coalesce(p.following_count, 0)::bigint,
    coalesce(p.rating_avg, 0)::numeric,
    coalesce(p.rating_count, p.reviews_count, 0)::bigint,
    coalesce(p.reviews_count, p.rating_count, 0)::bigint,
    coalesce(p.imported_yield, 0)::numeric,
    coalesce(p.imported_total_tips, 0)::bigint,
    coalesce(p.imported_won_tips, 0)::bigint,
    coalesce(p.imported_lost_tips, 0)::bigint,
    coalesce(p.imported_pending_tips, 0)::bigint,
    coalesce(p.imported_total_staked, 0)::numeric,
    coalesce(p.imported_profit, 0)::numeric,
    coalesce(p.imported_avg_odds, 0)::numeric,
    coalesce(p.imported_highest_odds, 0)::numeric,
    coalesce(p.imported_tips_amount, 0)::numeric,
    p.imported_tips_currency::text,
    p.stats_imported_at,
    p.created_at,
    p.updated_at
  from public.profiles p
  where coalesce(p.username::text, p.public_slug::text, p.email::text, '') <> '';
$$;

grant execute on function public.betai_public_profile_avatars_for_ui() to anon, authenticated;
