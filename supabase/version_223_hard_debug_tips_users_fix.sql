create extension if not exists pgcrypto;

drop table if exists tips cascade;

create table tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  author_id uuid,
  author_email text,
  author_name text,
  username text,
  league text,
  team_home text,
  team_away text,
  match text,
  match_time timestamptz,
  bet_type text,
  prediction text,
  odds numeric,
  analysis text,
  ai_probability integer default 0,
  ai_confidence integer default 0,
  ai_score integer default 0,
  ai_analysis text,
  access_type text default 'free',
  is_premium boolean default false,
  price numeric default 0,
  status text default 'pending',
  result text,
  tags text[] default '{}',
  notify_followers boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tips disable row level security;

create index if not exists idx_tips_user_id on tips(user_id);
create index if not exists idx_tips_author_id on tips(author_id);
create index if not exists idx_tips_created_at on tips(created_at desc);
create index if not exists idx_tips_is_premium on tips(is_premium);

drop view if exists tipster_ranking;
create view tipster_ranking as
select
  coalesce(author_id, user_id) as tipster_id,
  coalesce(max(author_name), max(username), split_part(max(author_email), '@', 1), 'Użytkownik') as username,
  max(author_email) as email,
  count(*)::int as total_tips,
  count(*) filter (where is_premium = true)::int as premium_tips,
  count(*) filter (where lower(coalesce(status,result,'')) in ('won','win','wygrany','wygrana'))::int as wins,
  count(*) filter (where lower(coalesce(status,result,'')) in ('lost','loss','lose','przegrany','przegrana'))::int as losses,
  0::numeric as roi,
  case when count(*) > 0 then round((count(*) filter (where lower(coalesce(status,result,'')) in ('won','win','wygrany','wygrana'))::numeric / count(*)::numeric) * 100, 1) else 0 end as winrate,
  0::numeric as earnings,
  max(created_at) as last_tip_at
from tips
where coalesce(author_id, user_id) is not null or username is not null or author_email is not null
group by coalesce(author_id, user_id)
order by total_tips desc, last_tip_at desc;

create table if not exists unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tip_id uuid,
  created_at timestamptz default now()
);
alter table unlocked_tips disable row level security;

create table if not exists tipster_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tipster_id uuid,
  status text default 'active',
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table tipster_subscriptions disable row level security;
