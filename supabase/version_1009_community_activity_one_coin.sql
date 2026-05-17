
-- supabase/version_1009_community_activity_one_coin.sql
-- Społeczność: każda aktywność liczy się po równo.
-- post = 1 Coin, komentarz = 1 Coin, reakcja = 1 Coin.
-- Nagrody portfela dalej zostają po 1 żeton przez claim_community_reward_v1008.

create or replace view public.community_weekly_ranking_v1008 as
with post_stats as (
  select
    p.author_id as user_id,
    lower(p.author_email) as email,
    coalesce(nullif(p.author_name, ''), split_part(p.author_email, '@', 1), 'Użytkownik') as username,
    count(*)::int as posts_count
  from public.community_posts p
  where p.created_at >= now() - interval '7 days'
  group by p.author_id, lower(p.author_email), coalesce(nullif(p.author_name, ''), split_part(p.author_email, '@', 1), 'Użytkownik')
),
comment_stats as (
  select
    c.author_id as user_id,
    lower(c.author_email) as email,
    count(*)::int as comments_count
  from public.community_comments c
  where c.created_at >= now() - interval '7 days'
  group by c.author_id, lower(c.author_email)
),
like_stats as (
  select
    p.author_id as user_id,
    lower(p.author_email) as email,
    count(r.id)::int as likes_received
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
left join public.profiles pr on pr.id = k.user_id or lower(pr.email) = k.email
order by community_points desc, posts_count desc, comments_count desc;

select 'v1009 community activity one coin scoring ready' as status;
