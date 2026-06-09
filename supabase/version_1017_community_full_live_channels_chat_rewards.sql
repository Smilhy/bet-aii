
-- supabase/version_1017_community_full_live_channels_chat_rewards.sql
-- Społeczność 10/10:
-- - osobny live chat: public.community_chat_messages,
-- - prawdziwe kanały przez channel_key,
-- - posty mają channel_key i są filtrowane po kanale,
-- - ranking społeczności liczy posty + komentarze + reakcje + chat,
-- - nagrody społeczności po 1 żeton,
-- - reset nagród w poniedziałek o 01:00,
-- - odbiór zapisuje portfel, historię i powiadomienia.

create extension if not exists pgcrypto;

create or replace function public.betai_weekly_period_monday_1am()
returns text
language sql
stable
as $$
  select to_char((now() - interval '1 hour'), 'IYYY-IW');
$$;

-- CHANNEL KEY FOR POSTS
alter table if exists public.community_posts
  add column if not exists channel_key text not null default 'ogolny';

update public.community_posts
set channel_key = 'ogolny'
where channel_key is null or trim(channel_key) = '';

-- REAL LIVE CHAT TABLE
create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null default 'ogolny',
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null,
  author_name text,
  avatar_url text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.community_chat_messages
  add column if not exists channel_key text not null default 'ogolny';

alter table public.community_chat_messages
  add column if not exists author_id uuid;

alter table public.community_chat_messages
  add column if not exists author_email text;

alter table public.community_chat_messages
  add column if not exists author_name text;

alter table public.community_chat_messages
  add column if not exists avatar_url text;

alter table public.community_chat_messages
  add column if not exists body text;

alter table public.community_chat_messages
  add column if not exists created_at timestamptz not null default now();

update public.community_chat_messages
set channel_key = 'ogolny'
where channel_key is null or trim(channel_key) = '';

create index if not exists community_posts_channel_created_idx
on public.community_posts(channel_key, created_at desc);

create index if not exists community_chat_messages_channel_created_idx
on public.community_chat_messages(channel_key, created_at desc);

alter table public.community_chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_chat_messages'
      and policyname='community_chat_messages_select_all_v1017'
  ) then
    create policy community_chat_messages_select_all_v1017
    on public.community_chat_messages
    for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_chat_messages'
      and policyname='community_chat_messages_insert_own_v1017'
  ) then
    create policy community_chat_messages_insert_own_v1017
    on public.community_chat_messages
    for insert
    with check (
      auth.uid() = author_id
      or lower(author_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

-- POSTS VIEW WITH SINGLE PROFILE AND CHANNEL
create or replace view public.community_posts_live_v1017 as
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
  coalesce(nullif(p.channel_key, ''), 'ogolny') as channel_key,
  p.created_at,
  p.updated_at,
  coalesce(r.likes_count, 0)::int as likes_count,
  coalesce(c.comments_count, 0)::int as comments_count
from public.community_posts p
left join lateral (
  select id, email, username, avatar_url, plan, subscription_status, created_at, updated_at
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

-- CHAT VIEW WITH SINGLE PROFILE
create or replace view public.community_chat_messages_live_v1017 as
select
  m.id,
  m.channel_key,
  m.author_id,
  m.author_email,
  coalesce(nullif(m.author_name, ''), nullif(pr.username, ''), split_part(m.author_email, '@', 1), 'Użytkownik') as author_name,
  m.avatar_url,
  pr.avatar_url as profile_avatar_url,
  pr.username,
  pr.plan,
  pr.subscription_status,
  m.body,
  m.created_at
from public.community_chat_messages m
left join lateral (
  select id, email, username, avatar_url, plan, subscription_status, created_at, updated_at
  from public.profiles pr0
  where pr0.id = m.author_id
     or lower(pr0.email) = lower(m.author_email)
  order by
    case when pr0.id = m.author_id then 0 else 1 end,
    pr0.updated_at desc nulls last,
    pr0.created_at desc nulls last
  limit 1
) pr on true;

-- COMMENTS VIEW WITH SINGLE PROFILE
create or replace view public.community_comments_live_v1017 as
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
left join lateral (
  select id, email, username, avatar_url, plan, subscription_status, created_at, updated_at
  from public.profiles pr0
  where pr0.id = c.author_id
     or lower(pr0.email) = lower(c.author_email)
  order by
    case when pr0.id = c.author_id then 0 else 1 end,
    pr0.updated_at desc nulls last,
    pr0.created_at desc nulls last
  limit 1
) pr on true;

-- WEEKLY RANKING: POSTS + COMMENTS + LIKES + CHAT = COIN/POINTS
create or replace view public.community_weekly_ranking_v1017 as
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
chat_stats as (
  select
    m.author_id as user_id,
    lower(m.author_email) as email,
    count(distinct m.id)::int as chat_count
  from public.community_chat_messages m
  where m.created_at >= now() - interval '7 days'
  group by m.author_id, lower(m.author_email)
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
  select user_id, email from chat_stats
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
  coalesce(ch.chat_count, 0)::int as chat_count,
  coalesce(ls.likes_received, 0)::int as likes_received,
  (
    coalesce(ps.posts_count, 0)
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
  where pr0.id = k.user_id
     or lower(pr0.email) = k.email
  order by
    case when pr0.id = k.user_id then 0 else 1 end,
    pr0.updated_at desc nulls last,
    pr0.created_at desc nulls last
  limit 1
) pr on true
order by community_points desc, posts_count desc, comments_count desc, chat_count desc;

-- WEEKLY COMMUNITY REWARDS
create table if not exists public.community_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  reward_key text not null,
  reward_title text not null,
  reward_tokens integer not null default 1,
  period_key text not null default public.betai_weekly_period_monday_1am(),
  created_at timestamptz not null default now()
);

alter table public.community_reward_claims
  add column if not exists email text;

alter table public.community_reward_claims
  add column if not exists reward_key text;

alter table public.community_reward_claims
  add column if not exists reward_title text;

alter table public.community_reward_claims
  add column if not exists reward_tokens integer not null default 1;

alter table public.community_reward_claims
  add column if not exists period_key text not null default public.betai_weekly_period_monday_1am();

update public.community_reward_claims
set email = lower(trim(coalesce(email, '')))
where email is not null;

with ranked as (
  select id,
         row_number() over (partition by user_id, reward_key, period_key order by created_at asc, id asc) rn
  from public.community_reward_claims
  where user_id is not null and reward_key is not null and period_key is not null
)
delete from public.community_reward_claims c
using ranked r
where c.id = r.id and r.rn > 1;

with ranked as (
  select id,
         row_number() over (partition by lower(email), reward_key, period_key order by created_at asc, id asc) rn
  from public.community_reward_claims
  where email is not null and email <> '' and reward_key is not null and period_key is not null
)
delete from public.community_reward_claims c
using ranked r
where c.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_reward_claims_user_reward_period_unique'
  ) then
    alter table public.community_reward_claims
      add constraint community_reward_claims_user_reward_period_unique
      unique (user_id, reward_key, period_key);
  end if;
exception when duplicate_object then null;
end $$;

create unique index if not exists community_reward_claims_email_reward_period_uidx
on public.community_reward_claims (lower(email), reward_key, period_key)
where email is not null and email <> '';

alter table public.community_reward_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_reward_claims'
      and policyname='community_reward_claims_select_own_v1017'
  ) then
    create policy community_reward_claims_select_own_v1017
    on public.community_reward_claims
    for select
    using (
      auth.uid() = user_id
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_reward_claims'
      and policyname='community_reward_claims_insert_own_v1017'
  ) then
    create policy community_reward_claims_insert_own_v1017
    on public.community_reward_claims
    for insert
    with check (
      auth.uid() = user_id
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

alter table if exists public.betai_token_wallets
  add column if not exists user_id uuid;

alter table if exists public.betai_token_wallets
  add column if not exists updated_at timestamptz default now();

alter table if exists public.betai_token_transactions
  add column if not exists ref_type text;

alter table if exists public.betai_token_transactions
  add column if not exists ref_id text;

alter table if exists public.betai_token_transactions
  add column if not exists ref_data jsonb;

alter table if exists public.betai_system_notifications
  add column if not exists reward_tokens integer not null default 0;

alter table if exists public.betai_system_notifications
  add column if not exists ref_type text;

alter table if exists public.betai_system_notifications
  add column if not exists ref_id text;

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
  v_period text := public.betai_weekly_period_monday_1am();
  v_claim_id uuid;
  v_existing_id uuid;
  v_email text := lower(trim(p_email));
  v_new_balance integer := 0;
  v_message text := coalesce(p_reward_title, 'Nagroda społeczności') || ': otrzymujesz 1 żeton.';
begin
  if v_email is null or v_email = '' then
    raise exception 'missing email';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  select id into v_existing_id
  from public.community_reward_claims
  where reward_key = p_reward_key
    and period_key = v_period
    and (user_id = p_user_id or lower(email) = v_email)
  order by created_at asc
  limit 1;

  if v_existing_id is not null then
    select coalesce(balance, 0) into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda społeczności była już odebrana w tym tygodniu.'
    );
  end if;

  insert into public.community_reward_claims (
    user_id, email, reward_key, reward_title, reward_tokens, period_key, created_at
  )
  values (
    p_user_id, v_email, p_reward_key, p_reward_title, 1, v_period, now()
  )
  on conflict (user_id, reward_key, period_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select coalesce(balance, 0) into v_new_balance
    from public.betai_token_wallets
    where lower(email) = v_email;

    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reward_tokens', 0,
      'period_key', v_period,
      'new_balance', coalesce(v_new_balance, 0),
      'message', 'Nagroda społeczności była już odebrana w tym tygodniu.'
    );
  end if;

  insert into public.betai_token_wallets (
    email, user_id, balance, welcome_bonus_claimed, updated_at
  )
  values (
    v_email, p_user_id, 1, true, now()
  )
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    welcome_bonus_claimed = true,
    updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions (
    email, delta_tokens, delta_pln, reason, ref_type, ref_id, ref_data, created_at
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
      'period_key', v_period,
      'reset_rule', 'monday_01_00'
    ),
    now()
  );

  insert into public.betai_system_notifications (
    recipient_email, title, body, message, reward_tokens, ref_type, ref_id, is_read, created_at
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
    'already_claimed', false,
    'reward_tokens', 1,
    'period_key', v_period,
    'new_balance', coalesce(v_new_balance, 0),
    'message', v_message,
    'reset_rule', 'monday_01_00'
  );
end;
$$;

grant execute on function public.claim_community_reward_v1008(uuid, text, text, text) to authenticated;

select 'v1017 community full live channels chat rewards ready' as status;
