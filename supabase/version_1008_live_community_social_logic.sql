
-- supabase/version_1008_live_community_social_logic.sql
-- Realna zakładka Społeczność: posty, komentarze, reakcje, ranking, nagrody po 1 żeton.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete cascade,
  author_email text not null,
  author_name text,
  avatar_url text,
  body text not null,
  post_type text not null default 'post',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete cascade,
  author_email text not null,
  author_name text,
  avatar_url text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, user_id, reaction_type)
);

create table if not exists public.community_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  reward_key text not null,
  reward_title text not null,
  reward_tokens integer not null default 1,
  period_key text not null default to_char(now(), 'IYYY-IW'),
  created_at timestamptz not null default now(),
  unique (user_id, reward_key, period_key)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reward_claims enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_posts' and policyname='community_posts_select_all') then
    create policy community_posts_select_all on public.community_posts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_posts' and policyname='community_posts_insert_own') then
    create policy community_posts_insert_own on public.community_posts for insert with check (auth.uid() = author_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_posts' and policyname='community_posts_update_own') then
    create policy community_posts_update_own on public.community_posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_posts' and policyname='community_posts_delete_own') then
    create policy community_posts_delete_own on public.community_posts for delete using (auth.uid() = author_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_comments' and policyname='community_comments_select_all') then
    create policy community_comments_select_all on public.community_comments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_comments' and policyname='community_comments_insert_own') then
    create policy community_comments_insert_own on public.community_comments for insert with check (auth.uid() = author_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_comments' and policyname='community_comments_delete_own') then
    create policy community_comments_delete_own on public.community_comments for delete using (auth.uid() = author_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_reactions' and policyname='community_reactions_select_all') then
    create policy community_reactions_select_all on public.community_reactions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_reactions' and policyname='community_reactions_insert_own') then
    create policy community_reactions_insert_own on public.community_reactions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_reactions' and policyname='community_reactions_delete_own') then
    create policy community_reactions_delete_own on public.community_reactions for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_reward_claims' and policyname='community_reward_claims_select_own') then
    create policy community_reward_claims_select_own on public.community_reward_claims for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_reward_claims' and policyname='community_reward_claims_insert_own') then
    create policy community_reward_claims_insert_own on public.community_reward_claims for insert with check (auth.uid() = user_id);
  end if;
end $$;

alter table if exists public.betai_system_notifications
  add column if not exists reward_tokens integer not null default 0;

alter table if exists public.betai_system_notifications
  add column if not exists ref_type text;

alter table if exists public.betai_system_notifications
  add column if not exists ref_id text;

alter table if exists public.betai_token_transactions
  add column if not exists ref_data jsonb;

create or replace view public.community_posts_live_v1008 as
select
  p.id,
  p.author_id,
  p.author_email,
  coalesce(nullif(p.author_name, ''), nullif(pr.username, ''), split_part(p.author_email, '@', 1), 'Użytkownik') as author_name,
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
left join public.profiles pr on pr.id = p.author_id or lower(pr.email) = lower(p.author_email)
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
  coalesce(nullif(c.author_name, ''), nullif(pr.username, ''), split_part(c.author_email, '@', 1), 'Użytkownik') as author_name,
  c.avatar_url,
  pr.avatar_url as profile_avatar_url,
  pr.username,
  pr.plan,
  pr.subscription_status,
  c.body,
  c.created_at
from public.community_comments c
left join public.profiles pr on pr.id = c.author_id or lower(pr.email) = lower(c.author_email);

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
  (coalesce(ps.posts_count, 0) * 10 + coalesce(cs.comments_count, 0) * 4 + coalesce(ls.likes_received, 0) * 2)::int as community_points
from keys k
left join post_stats ps on ps.email = k.email
left join comment_stats cs on cs.email = k.email
left join like_stats ls on ls.email = k.email
left join public.profiles pr on pr.id = k.user_id or lower(pr.email) = k.email
order by community_points desc, posts_count desc, comments_count desc;

create or replace function public.claim_community_reward_v1008(
  p_user_id uuid,
  p_email text,
  p_reward_key text,
  p_reward_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'IYYY-IW');
  v_claim_id uuid;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
  v_message text := coalesce(p_reward_title, 'Nagroda społeczności') || ': otrzymujesz 1 żeton.';
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  insert into public.community_reward_claims (
    user_id,
    email,
    reward_key,
    reward_title,
    reward_tokens,
    period_key
  )
  values (
    p_user_id,
    v_email,
    p_reward_key,
    p_reward_title,
    1,
    v_period
  )
  on conflict (user_id, reward_key, period_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select coalesce(balance, 0)
    into v_new_balance
    from public.betai_token_wallets
    where email = v_email;

    return jsonb_build_object(
      'claimed', false,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda społeczności była już odebrana.'
    );
  end if;

  insert into public.betai_token_wallets (email, user_id, balance, welcome_bonus_claimed, updated_at)
  values (v_email, p_user_id, 1, true, now())
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    welcome_bonus_claimed = true,
    updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions (
    email,
    delta_tokens,
    delta_pln,
    reason,
    ref_type,
    ref_id,
    ref_data,
    created_at
  )
  values (
    v_email,
    1,
    0,
    'community_reward:' || p_reward_key,
    'community_reward',
    v_claim_id::text,
    jsonb_build_object(
      'reward_key', p_reward_key,
      'reward_title', p_reward_title,
      'message', v_message,
      'period_key', v_period
    ),
    now()
  );

  insert into public.betai_system_notifications (
    recipient_email,
    title,
    body,
    message,
    reward_tokens,
    ref_type,
    ref_id,
    is_read,
    created_at
  )
  values (
    v_email,
    'Nagroda społeczności',
    v_message,
    v_message,
    1,
    'community_reward',
    v_claim_id::text,
    false,
    now()
  );

  return jsonb_build_object(
    'claimed', true,
    'reward_tokens', 1,
    'period_key', v_period,
    'new_balance', coalesce(v_new_balance, 0),
    'message', v_message
  );
end;
$$;

grant execute on function public.claim_community_reward_v1008(uuid, text, text, text) to authenticated;

select 'v1008 live community social logic ready' as status;
