-- =========================================
-- VERSION 225 - REAL FIX: TIPS + USERS + SCHEMA CACHE
-- =========================================
-- Wklej CAŁOŚĆ w Supabase SQL Editor i kliknij Run.
-- Nie wklejaj znaków ```.

-- 1) Rozszerzamy / tworzymy profiles bez kasowania auth.users
create table if not exists public.profiles (
  id uuid primary key,
  email text,
  username text,
  public_slug text,
  plan text default 'free',
  subscription_status text default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_account_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists plan text default 'free';
alter table public.profiles add column if not exists subscription_status text default 'inactive';
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists stripe_account_id text;
alter table public.profiles add column if not exists current_period_end timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Uzupełnij profile dla istniejących użytkowników
insert into public.profiles (id, email, username, public_slug)
select
  u.id,
  u.email,
  coalesce(split_part(u.email, '@', 1), 'user'),
  lower(regexp_replace(coalesce(split_part(u.email, '@', 1), 'user'), '[^a-zA-Z0-9]+', '-', 'g'))
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  username = coalesce(public.profiles.username, excluded.username),
  public_slug = coalesce(public.profiles.public_slug, excluded.public_slug);

-- Auto profil dla nowych kont
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, public_slug)
  values (
    new.id,
    new.email,
    coalesce(split_part(new.email, '@', 1), 'user'),
    lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'user'), '[^a-zA-Z0-9]+', '-', 'g'))
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    public_slug = coalesce(public.profiles.public_slug, excluded.public_slug);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2) Tabela tips: tworzymy, ale NIE robimy generated column, bo frontend i Netlify wysyłają is_premium
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Wszystkie kolumny używane przez frontend + Netlify Functions
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists username text;
alter table public.tips add column if not exists league text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists home_team text;
alter table public.tips add column if not exists away_team text;
alter table public.tips add column if not exists match text;
alter table public.tips add column if not exists match_name text;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists prediction text;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists description text;
alter table public.tips add column if not exists ai_probability integer default 0;
alter table public.tips add column if not exists ai_confidence integer default 0;
alter table public.tips add column if not exists ai_score integer default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists model_reason text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric default 0;
alter table public.tips add column if not exists status text default 'pending';
alter table public.tips add column if not exists result text;
alter table public.tips add column if not exists tags text[] default '{}';
alter table public.tips add column if not exists notify_followers boolean default true;
alter table public.tips add column if not exists updated_at timestamptz default now();

-- Synchronizacja starych rekordów i aliasów
update public.tips set
  author_id = coalesce(author_id, user_id),
  user_id = coalesce(user_id, author_id),
  author_name = coalesce(author_name, username, split_part(author_email, '@', 1), 'Użytkownik'),
  username = coalesce(username, author_name, split_part(author_email, '@', 1), 'Użytkownik'),
  team_home = coalesce(team_home, home_team, split_part(coalesce(match, match_name, ''), ' vs ', 1)),
  team_away = coalesce(team_away, away_team, nullif(split_part(coalesce(match, match_name, ''), ' vs ', 2), '')),
  home_team = coalesce(home_team, team_home),
  away_team = coalesce(away_team, team_away),
  match = coalesce(match, match_name, trim(coalesce(team_home,'') || ' vs ' || coalesce(team_away,''))),
  match_name = coalesce(match_name, match),
  prediction = coalesce(prediction, bet_type, market),
  bet_type = coalesce(bet_type, prediction, market),
  access_type = case when coalesce(is_premium, false) = true then 'premium' else coalesce(access_type, 'free') end,
  is_premium = case when coalesce(access_type, 'free') = 'premium' then true else coalesce(is_premium, false) end,
  status = coalesce(status, result, 'pending'),
  ai_analysis = coalesce(ai_analysis, analysis, description, ''),
  ai_probability = coalesce(ai_probability, ai_confidence, 0),
  ai_confidence = coalesce(ai_confidence, ai_probability, 0),
  ai_score = coalesce(ai_score, 0),
  price = coalesce(price, 0),
  tags = coalesce(tags, '{}'),
  notify_followers = coalesce(notify_followers, true);

-- 3) Tabele pomocnicze, żeby fetch nie wywalał aplikacji
create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tip_id uuid,
  price numeric default 0,
  created_at timestamptz default now(),
  unique(user_id, tip_id)
);

create table if not exists public.tipster_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tipster_id uuid,
  status text default 'active',
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- 4) Widok rankingu realnego z tips
create or replace view public.tipster_ranking as
select
  coalesce(t.author_id, t.user_id) as tipster_id,
  coalesce(max(t.author_name), max(t.username), max(split_part(t.author_email, '@', 1)), 'Użytkownik') as username,
  max(t.author_email) as email,
  count(*)::int as total_tips,
  count(*) filter (where lower(coalesce(t.result, t.status, '')) in ('won','win'))::int as wins,
  count(*) filter (where lower(coalesce(t.result, t.status, '')) in ('lost','loss','lose'))::int as losses,
  case when count(*) > 0 then round((count(*) filter (where lower(coalesce(t.result, t.status, '')) in ('won','win'))::numeric / count(*)::numeric) * 100, 2) else 0 end as winrate,
  coalesce(sum(case when lower(coalesce(t.result, t.status, '')) in ('won','win') then coalesce(t.odds,0) - 1 when lower(coalesce(t.result, t.status, '')) in ('lost','loss','lose') then -1 else 0 end),0)::numeric as roi,
  coalesce(sum(coalesce(t.price,0)),0)::numeric as earnings
from public.tips t
where coalesce(t.author_id, t.user_id) is not null
group by coalesce(t.author_id, t.user_id);

-- 5) Debug: RLS OFF, żeby najpierw działało. Potem można zabezpieczyć.
alter table public.tips disable row level security;
alter table public.profiles disable row level security;
alter table public.unlocked_tips disable row level security;
alter table public.tipster_subscriptions disable row level security;

-- 6) Indexy
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_access_type on public.tips(access_type);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_slug on public.profiles(public_slug);

-- 7) Wymuś odświeżenie schema cache PostgREST/Supabase
notify pgrst, 'reload schema';

-- TEST po uruchomieniu:
-- select column_name from information_schema.columns where table_schema='public' and table_name='tips' order by ordinal_position;
-- select * from public.tipster_ranking limit 10;
