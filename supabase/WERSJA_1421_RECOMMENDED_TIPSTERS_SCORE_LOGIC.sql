-- WERSJA 1421 — POLECANI TYPERZY: LOGIKA SCORE / AKTYWNOŚĆ / PREMIUM
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- "Polecani typerzy" nie są losowi i nie trafiają tam puste konta.
-- Kandydat musi mieć realną wartość: typy, aktywność społeczności albo Premium.
--
-- Funkcja zwraca top użytkowników według recommended_score.
-- Frontend używa RPC: public.get_recommended_tipsters_v1421(p_limit)

create extension if not exists pgcrypto;

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
begin
  return query
  with profile_base as (
    select
      p.id,
      lower(coalesce(p.email, '')) as email,
      coalesce(nullif(p.username, ''), split_part(coalesce(p.email, ''), '@', 1), 'Użytkownik') as username,
      coalesce(p.avatar_url, '') as avatar_url,
      coalesce(p.plan, 'free') as plan,
      coalesce(p.subscription_status, 'free') as subscription_status,
      coalesce(p.is_premium, false)
        or lower(coalesce(p.plan, '')) = 'premium'
        or lower(coalesce(p.subscription_status, '')) in ('premium','active','trialing') as is_premium,
      coalesce(p.imported_total_tips, 0)::integer as total_tips,
      coalesce(p.imported_won_tips, 0)::integer as won_tips,
      coalesce(p.imported_yield, 0)::numeric as yield_value,
      coalesce(p.imported_profit, 0)::numeric as profit,
      coalesce(p.followers_count, 0)::integer as followers_count,
      coalesce(p.is_admin, false) as is_admin,
      coalesce(p.created_at, now()) as created_at
    from public.profiles p
    where coalesce(p.email, '') <> ''
      and coalesce(p.is_admin, false) = false
  ),
  posts as (
    select
      cp.author_id as id,
      lower(coalesce(cp.author_email, '')) as email,
      count(*)::integer as posts_14d
    from public.community_posts cp
    where cp.created_at >= now() - interval '14 days'
    group by cp.author_id, lower(coalesce(cp.author_email, ''))
  ),
  chat as (
    select
      cm.author_id as id,
      lower(coalesce(cm.author_email, '')) as email,
      count(*)::integer as chat_7d
    from public.community_chat_messages cm
    where cm.created_at >= now() - interval '7 days'
      and coalesce(cm.body, '') <> ''
    group by cm.author_id, lower(coalesce(cm.author_email, ''))
  ),
  recent_tips as (
    -- bezpiecznie: jeśli w przyszłości dodamy osobny licznik typów 30d, można go tu podpiąć.
    -- obecnie korzystamy z imported_total_tips z profiles, żeby SQL działał stabilnie na istniejącej bazie.
    select
      p.id as id,
      lower(coalesce(p.email, '')) as email,
      0::integer as recent_tips_30d
    from public.profiles p
  ),
  scored as (
    select
      p.*,
      coalesce(po.posts_14d, 0)::integer as posts_14d,
      coalesce(ch.chat_7d, 0)::integer as chat_7d,
      coalesce(rt.recent_tips_30d, 0)::integer as recent_tips_30d,

      (
        case when p.is_premium then 25 else 0 end
        + least(coalesce(rt.recent_tips_30d, 0) * 5, 35)
        + least(p.total_tips * 2, 30)
        + least(coalesce(ch.chat_7d, 0) * 2, 14)
        + least(coalesce(po.posts_14d, 0) * 6, 24)
        + case when p.yield_value >= 10 then 10 else 0 end
        + case when p.profit > 0 then 8 else 0 end
        + least(p.followers_count * 2, 12)
      )::numeric as score
    from profile_base p
    left join posts po on (po.id = p.id or (po.email <> '' and po.email = p.email))
    left join chat ch on (ch.id = p.id or (ch.email <> '' and ch.email = p.email))
    left join recent_tips rt on (rt.id = p.id or (rt.email <> '' and rt.email = p.email))
  ),
  eligible as (
    select *
    from scored
    where
      (
        is_premium
        or total_tips >= 5
        or recent_tips_30d >= 3
      )
      and
      (
        posts_14d >= 1
        or chat_7d >= 3
        or recent_tips_30d >= 1
        or is_premium
      )
      and score >= 20
  )
  select
    e.id,
    e.email,
    e.username,
    e.avatar_url,
    e.plan,
    e.subscription_status,
    e.is_premium,
    e.total_tips,
    e.won_tips,
    e.yield_value,
    e.profit,
    e.followers_count,
    e.posts_14d,
    e.chat_7d,
    e.recent_tips_30d,
    e.score as recommended_score,
    case
      when e.is_premium and e.recent_tips_30d > 0 then 'Premium • aktywny typer'
      when e.recent_tips_30d > 0 then e.recent_tips_30d::text || ' typów / 30 dni'
      when e.posts_14d > 0 then e.posts_14d::text || ' postów / 14 dni'
      when e.chat_7d > 0 then e.chat_7d::text || ' wiadomości / 7 dni'
      when e.is_premium then 'Premium'
      else 'Aktywny typer'
    end as recommendation_label
  from eligible e
  order by e.score desc, e.profit desc, e.yield_value desc, e.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.get_recommended_tipsters_v1421(integer) to anon, authenticated;

select 'WERSJA 1421 recommended tipsters score logic ready' as status;
