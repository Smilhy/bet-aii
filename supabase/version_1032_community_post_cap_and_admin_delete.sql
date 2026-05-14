
-- supabase/version_1032_community_post_cap_and_admin_delete.sql
-- Domknięcie:
-- - ranking nadal liczy posty maksymalnie 1/doba,
-- - dodana polityka admin delete dla community_posts, żeby admin mógł moderować posty.

create extension if not exists pgcrypto;

drop view if exists public.community_weekly_ranking_v1017;

create view public.community_weekly_ranking_v1017 as
with post_stats as (
  select
    p.author_id as user_id,
    lower(p.author_email) as email,
    coalesce(nullif(p.author_name, ''), split_part(p.author_email, '@', 1), 'Użytkownik') as username,
    count(distinct p.id)::int as posts_count,
    count(distinct ((p.created_at at time zone 'Europe/Warsaw')::date))::int as rewarded_post_days
  from public.community_posts p
  where p.created_at >= now() - interval '7 days'
  group by p.author_id, lower(p.author_email), coalesce(nullif(p.author_name, ''), split_part(p.author_email, '@', 1), 'Użytkownik')
),
comment_stats as (
  select c.author_id as user_id, lower(c.author_email) as email, count(distinct c.id)::int as comments_count
  from public.community_comments c
  where c.created_at >= now() - interval '7 days'
  group by c.author_id, lower(c.author_email)
),
chat_stats as (
  select m.author_id as user_id, lower(m.author_email) as email, count(distinct m.id)::int as chat_count
  from public.community_chat_messages m
  where m.created_at >= now() - interval '7 days'
  group by m.author_id, lower(m.author_email)
),
like_stats as (
  select p.author_id as user_id, lower(p.author_email) as email, count(distinct r.id)::int as likes_received
  from public.community_posts p
  left join public.community_reactions r on r.post_id = p.id
  where p.created_at >= now() - interval '7 days'
  group by p.author_id, lower(p.author_email)
),
keys as (
  select user_id, email from post_stats
  union select user_id, email from comment_stats
  union select user_id, email from chat_stats
  union select user_id, email from like_stats
)
select
  k.user_id,
  k.email,
  coalesce(pr.username, ps.username, split_part(k.email, '@', 1), 'Użytkownik') as username,
  pr.avatar_url,
  coalesce(ps.posts_count, 0)::int as posts_count,
  coalesce(ps.rewarded_post_days, 0)::int as rewarded_post_days,
  coalesce(cs.comments_count, 0)::int as comments_count,
  coalesce(ch.chat_count, 0)::int as chat_count,
  coalesce(ls.likes_received, 0)::int as likes_received,
  (
    coalesce(ps.rewarded_post_days, 0)
    + coalesce(cs.comments_count, 0)
    + coalesce(ch.chat_count, 0)
    + coalesce(ls.likes_received, 0)
  )::int as community_points
from keys k
left join post_stats ps on ps.email = k.email
left join comment_stats cs on cs.email = k.email
left join chat_stats ch on ch.email = k.email
left join like_stats ls on ls.email = k.email
left join lateral (
  select id, email, username, avatar_url
  from public.profiles pr0
  where pr0.id = k.user_id or lower(pr0.email) = k.email
  order by case when pr0.id = k.user_id then 0 else 1 end, pr0.updated_at desc nulls last, pr0.created_at desc nulls last
  limit 1
) pr on true
order by community_points desc, rewarded_post_days desc, posts_count desc, comments_count desc, chat_count desc;

alter table if exists public.community_posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_posts'
      and policyname='community_posts_delete_admin_v1032'
  ) then
    create policy community_posts_delete_admin_v1032
    on public.community_posts
    for delete
    using (
      lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
    );
  end if;
end $$;

select 'v1032 community post cap and admin delete ready' as status;
