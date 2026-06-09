-- VERSION 227 - RESTORE DASHBOARD LOGIC / TIPS FREE + PREMIUM
-- Bezpieczna migracja: NIE usuwa tabel i NIE kasuje typów.
-- Wklej w Supabase SQL Editor i kliknij RUN.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  username text,
  public_slug text unique,
  plan text default 'free',
  subscription_status text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.profiles (id, email, username, public_slug, created_at, updated_at)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'username', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1), 'user'),
  lower(regexp_replace(coalesce(nullif(u.raw_user_meta_data->>'username', ''), split_part(u.email, '@', 1), u.id::text), '[^a-zA-Z0-9]+', '-', 'g')),
  coalesce(u.created_at, now()),
  now()
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  username = coalesce(public.profiles.username, excluded.username),
  public_slug = coalesce(public.profiles.public_slug, excluded.public_slug),
  updated_at = now();

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tips
  add column if not exists user_id uuid,
  add column if not exists author_id uuid,
  add column if not exists author_email text,
  add column if not exists author_name text,
  add column if not exists username text,
  add column if not exists league text,
  add column if not exists team_home text,
  add column if not exists team_away text,
  add column if not exists match text,
  add column if not exists match_time timestamptz,
  add column if not exists bet_type text,
  add column if not exists prediction text,
  add column if not exists odds numeric default 0,
  add column if not exists analysis text,
  add column if not exists description text,
  add column if not exists ai_probability integer default 0,
  add column if not exists ai_confidence integer default 0,
  add column if not exists confidence integer default 0,
  add column if not exists ai_score integer default 0,
  add column if not exists ai_analysis text,
  add column if not exists access_type text default 'free',
  add column if not exists is_premium boolean default false,
  add column if not exists premium boolean default false,
  add column if not exists price numeric default 0,
  add column if not exists status text default 'pending',
  add column if not exists result text default 'pending',
  add column if not exists tags text[] default '{}',
  add column if not exists notify_followers boolean default true,
  add column if not exists ai_source text,
  add column if not exists live_status text,
  add column if not exists live_minute integer;

alter table public.tips drop constraint if exists tips_access_type_check;
alter table public.tips add constraint tips_access_type_check check (access_type in ('free','premium'));
alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check check (status in ('pending','live','won','win','lost','loss','void'));

create or replace function public.normalize_tip_before_save()
returns trigger
language plpgsql
as $$
begin
  new.user_id := coalesce(new.user_id, new.author_id);
  new.author_id := coalesce(new.author_id, new.user_id);
  new.username := coalesce(nullif(new.username, ''), nullif(new.author_name, ''), split_part(coalesce(new.author_email, ''), '@', 1), 'Użytkownik');
  new.author_name := coalesce(nullif(new.author_name, ''), new.username, 'Użytkownik');
  new.match := coalesce(nullif(new.match, ''), trim(coalesce(new.team_home, '') || ' vs ' || coalesce(new.team_away, '')));
  new.bet_type := coalesce(nullif(new.bet_type, ''), nullif(new.prediction, ''), 'Typ');
  new.prediction := coalesce(nullif(new.prediction, ''), new.bet_type);
  new.ai_probability := coalesce(new.ai_probability, new.ai_confidence, new.confidence, 0);
  new.ai_confidence := coalesce(new.ai_confidence, new.ai_probability, new.confidence, 0);
  new.confidence := coalesce(new.confidence, new.ai_confidence, new.ai_probability, 0);
  new.access_type := case when new.access_type = 'premium' or new.is_premium = true or new.premium = true or coalesce(new.price,0) > 0 then 'premium' else 'free' end;
  new.is_premium := (new.access_type = 'premium');
  new.premium := (new.access_type = 'premium');
  new.price := case when new.access_type = 'premium' then coalesce(new.price, 0) else 0 end;
  new.status := coalesce(nullif(new.status, ''), 'pending');
  new.result := coalesce(nullif(new.result, ''), new.status, 'pending');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists normalize_tip_before_save_trigger on public.tips;
create trigger normalize_tip_before_save_trigger
before insert or update on public.tips
for each row execute function public.normalize_tip_before_save();

create table if not exists public.unlocked_tips (id uuid primary key default gen_random_uuid(), user_id uuid, tip_id uuid, created_at timestamptz default now());
create table if not exists public.tipster_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid, tipster_id uuid, status text default 'active', expires_at timestamptz, created_at timestamptz default now());
create table if not exists public.tipster_follows (id uuid primary key default gen_random_uuid(), follower_id uuid, tipster_id uuid, created_at timestamptz default now(), unique(follower_id, tipster_id));
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid, title text, message text, type text default 'info', is_read boolean default false, created_at timestamptz default now());
create table if not exists public.earnings (id uuid primary key default gen_random_uuid(), tipster_id uuid, amount numeric default 0, commission numeric default 0, created_at timestamptz default now());

create or replace view public.tipster_stats as
select coalesce(t.author_id, t.user_id) as tipster_id,
  count(*)::int as total_tips,
  sum(case when lower(coalesce(t.result, t.status, 'pending')) in ('win','won') then 1 else 0 end)::int as wins,
  sum(case when lower(coalesce(t.result, t.status, 'pending')) in ('loss','lost','lose') then 1 else 0 end)::int as losses,
  round(case when count(*) = 0 then 0 else (sum(case when lower(coalesce(t.result, t.status, 'pending')) in ('win','won') then 1 else 0 end)::numeric / nullif(count(*),0)) * 100 end, 2) as winrate
from public.tips t
where coalesce(t.author_id, t.user_id) is not null
group by coalesce(t.author_id, t.user_id);

create or replace view public.tipster_earnings_summary as
select tipster_id, coalesce(sum(amount),0) as earnings, coalesce(sum(commission),0) as platform_commission
from public.earnings where tipster_id is not null group by tipster_id;

create or replace view public.tipster_ranking as
select p.id as tipster_id, p.email, p.username, p.public_slug,
  coalesce(ts.total_tips,0) as total_tips, coalesce(ts.wins,0) as wins, coalesce(ts.losses,0) as losses, coalesce(ts.winrate,0) as winrate,
  coalesce(es.earnings,0) as earnings, coalesce(es.platform_commission,0) as platform_commission,
  round(case when coalesce(ts.total_tips,0) = 0 then 0 else coalesce(es.earnings,0) / nullif(ts.total_tips,0) end, 2) as roi
from public.profiles p
left join public.tipster_stats ts on ts.tipster_id = p.id
left join public.tipster_earnings_summary es on es.tipster_id = p.id
where coalesce(ts.total_tips,0) > 0 or coalesce(es.earnings,0) > 0
order by earnings desc, winrate desc, total_tips desc;

create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_access_type on public.tips(access_type);
create index if not exists idx_profiles_public_slug on public.profiles(public_slug);

alter table public.tips disable row level security;
alter table public.profiles disable row level security;
notify pgrst, 'reload schema';
select 'OK v227: dashboard/tips/free/premium/ranking schema restored without deleting data' as status;
