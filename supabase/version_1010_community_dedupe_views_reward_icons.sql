
-- supabase/version_1010_community_dedupe_views_reward_icons.sql
-- Naprawia duplikowanie postów/komentarzy przez JOIN profiles i zostawia jeden profil na rekord.

create or replace view public.community_posts_live_v1008 as
select
  p.id,
  p.author_id,
  p.author_email,
  coalesce(
    nullif(p.author_name, ''),
    nullif(pr.username, ''),
    split_part(p.author_email, '@', 1),
    'Użytkownik'
  ) as author_name,
  p.avatar_url,
  pr.avatar_url as profile_avatar_url,
  pr.username,
  pr.plan,
  pr.subscription_status,
  p.body,
  p.post_type,
  p.created_at,
  p.updated_at,
  coalesce(r.likes_count, 0)::int as likes_count,
  coalesce(c.comments_count, 0)::int as comments_count
from public.community_posts p
left join lateral (
  select id, email, username, avatar_url, plan, subscription_status
  from public.profiles pr0
  where pr0.id = p.author_id
     or lower(pr0.email) = lower(p.author_email)
  order by
    case when pr0.id = p.author_id then 0 else 1 end,
    pr0.updated_at desc nulls last,
    pr0.created_at desc nulls last
  limit 1
) pr on true
left join (
  select post_id, count(*)::int as likes_count
  from public.community_reactions
  where reaction_type = 'like'
  group by post_id
) r on r.post_id = p.id
left join (
  select post_id, count(*)::int as comments_count
  from public.community_comments
  group by post_id
) c on c.post_id = p.id;

create or replace view public.community_comments_live_v1008 as
select
  c.id,
  c.post_id,
  c.author_id,
  c.author_email,
  coalesce(
    nullif(c.author_name, ''),
    nullif(pr.username, ''),
    split_part(c.author_email, '@', 1),
    'Użytkownik'
  ) as author_name,
  c.avatar_url,
  pr.avatar_url as profile_avatar_url,
  pr.username,
  pr.plan,
  pr.subscription_status,
  c.body,
  c.created_at
from public.community_comments c
left join lateral (
  select id, email, username, avatar_url, plan, subscription_status
  from public.profiles pr0
  where pr0.id = c.author_id
     or lower(pr0.email) = lower(c.author_email)
  order by
    case when pr0.id = c.author_id then 0 else 1 end,
    pr0.updated_at desc nulls last,
    pr0.created_at desc nulls last
  limit 1
) pr on true;

create or replace view public.community_weekly_ranking_v1008 as
with post_stats as (
  select
    p.author_id as user_id,
    lower(p.author_email) as email,
    coalesce(nullif(p.author_name, ''), split_part(p.author_email, '@', 1), 'Użytkownik') as username,
    count(distinct p.id)::int as posts_count
  from public.community_posts p
  where p.created_at >= now() - interval '7 days'
  group by p.author_id, lower(p.author_email), coalesce(nullif(p.author_name, ''), split_part(p.author_email, '@', 1), 'Użytkownik')
),
comment_stats as (
  select
    c.author_id as user_id,
    lower(c.author_email) as email,
    count(distinct c.id)::int as comments_count
  from public.community_comments c
  where c.created_at >= now() - interval '7 days'
  group by c.author_id, lower(c.author_email)
),
like_stats as (
  select
    p.author_id as user_id,
    lower(p.author_email) as email,
    count(distinct r.id)::int as likes_received
  from public.community_posts p
  left join public.community_reactions r on r.post_id = p.id
  where p.created_at >= now() - interval '7 days'
  group by p.author_id, lower(p.author_email)
),
keys as (
  select user_id, email from post_stats
  union
  select user_id, email from comment_stats
  union
  select user_id, email from like_stats
)
select
  k.user_id,
  k.email,
  coalesce(pr.username, ps.username, split_part(k.email, '@', 1), 'Użytkownik') as username,
  pr.avatar_url,
  coalesce(ps.posts_count, 0)::int as posts_count,
  coalesce(cs.comments_count, 0)::int as comments_count,
  coalesce(ls.likes_received, 0)::int as likes_received,
  (
    coalesce(ps.posts_count, 0)
    + coalesce(cs.comments_count, 0)
    + coalesce(ls.likes_received, 0)
  )::int as community_points
from keys k
left join post_stats ps on ps.email = k.email
left join comment_stats cs on cs.email = k.email
left join like_stats ls on ls.email = k.email
left join lateral (
  select id, email, username, avatar_url
  from public.profiles pr0
  where pr0.id = k.user_id
     or lower(pr0.email) = k.email
  order by
    case when pr0.id = k.user_id then 0 else 1 end,
    pr0.updated_at desc nulls last,
    pr0.created_at desc nulls last
  limit 1
) pr on true
order by community_points desc, posts_count desc, comments_count desc;

select 'v1010 community dedupe views ready' as status;
