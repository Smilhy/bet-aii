-- =========================================
-- BETAI LIVE PROFIT RANKING V198
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.betai_typer_stats (
  email text primary key,
  posted integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  open integer not null default 0,
  yield numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  reputation integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.betai_typer_stats add column if not exists posted integer not null default 0;
alter table public.betai_typer_stats add column if not exists wins integer not null default 0;
alter table public.betai_typer_stats add column if not exists losses integer not null default 0;
alter table public.betai_typer_stats add column if not exists open integer not null default 0;
alter table public.betai_typer_stats add column if not exists yield numeric(12,2) not null default 0;
alter table public.betai_typer_stats add column if not exists profit numeric(12,2) not null default 0;
alter table public.betai_typer_stats add column if not exists reputation integer not null default 0;
alter table public.betai_typer_stats add column if not exists created_at timestamptz not null default now();
alter table public.betai_typer_stats add column if not exists updated_at timestamptz not null default now();

alter table public.betai_typer_stats disable row level security;
grant select, insert, update on public.betai_typer_stats to anon, authenticated;

create table if not exists public.betai_league_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text unique,
  nickname text,
  profit numeric default 0,
  yield numeric default 0,
  tips integer default 0,
  wins integer default 0,
  loses integer default 0,
  reputation integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.betai_league_users disable row level security;
grant select, insert, update on public.betai_league_users to anon, authenticated;

-- seed all real users into league and live stats
insert into public.betai_league_users (user_id, email, nickname, profit, yield, tips, wins, loses, reputation)
select
  u.id,
  lower(u.email),
  split_part(lower(u.email), '@', 1),
  0, 0, 0, 0, 0, 0
from auth.users u
where u.email is not null
on conflict (email) do update
set user_id = excluded.user_id,
    nickname = excluded.nickname,
    updated_at = now();

insert into public.betai_typer_stats (email, posted, wins, losses, open, yield, profit, reputation, created_at, updated_at)
select
  lower(u.email), 0, 0, 0, 0, 0, 0, 0, now(), now()
from auth.users u
where u.email is not null
on conflict (email) do nothing;

create or replace function public.betai_sync_new_user_everywhere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.betai_league_users (user_id, email, nickname, profit, yield, tips, wins, loses, reputation)
  values (
    new.id,
    lower(new.email),
    split_part(lower(new.email), '@', 1),
    0, 0, 0, 0, 0, 0
  )
  on conflict (email) do update
  set user_id = excluded.user_id,
      nickname = excluded.nickname,
      updated_at = now();

  insert into public.betai_typer_stats (email, posted, wins, losses, open, yield, profit, reputation, created_at, updated_at)
  values (lower(new.email), 0, 0, 0, 0, 0, 0, 0, now(), now())
  on conflict (email) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_betai_sync_new_user_everywhere on auth.users;
create trigger trg_betai_sync_new_user_everywhere
after insert on auth.users
for each row execute function public.betai_sync_new_user_everywhere();

create or replace function public.betai_sync_league_from_live_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.betai_league_users (
    email, nickname, profit, yield, tips, wins, loses, reputation, updated_at
  )
  values (
    lower(new.email),
    split_part(lower(new.email), '@', 1),
    coalesce(new.profit, 0),
    coalesce(new.yield, 0),
    coalesce(new.posted, 0),
    coalesce(new.wins, 0),
    coalesce(new.losses, 0),
    coalesce(new.reputation, 0),
    now()
  )
  on conflict (email) do update
  set
    profit = excluded.profit,
    yield = excluded.yield,
    tips = excluded.tips,
    wins = excluded.wins,
    loses = excluded.loses,
    reputation = excluded.reputation,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_betai_sync_league_from_live_stats on public.betai_typer_stats;
create trigger trg_betai_sync_league_from_live_stats
after insert or update on public.betai_typer_stats
for each row execute function public.betai_sync_league_from_live_stats();

-- one-time sync existing live stats into league table
update public.betai_league_users l
set
  profit = coalesce(s.profit, 0),
  yield = coalesce(s.yield, 0),
  tips = coalesce(s.posted, 0),
  wins = coalesce(s.wins, 0),
  loses = coalesce(s.losses, 0),
  reputation = coalesce(s.reputation, 0),
  updated_at = now()
from public.betai_typer_stats s
where lower(l.email) = lower(s.email);

drop view if exists public.betai_league_top100;
create view public.betai_league_top100 as
select
  lower(l.email) as email,
  coalesce(nullif(l.nickname, ''), split_part(lower(l.email), '@', 1)) as nickname,
  coalesce(s.profit, l.profit, 0)::numeric(12,2) as profit,
  coalesce(s.yield, l.yield, 0)::numeric(12,2) as yield,
  coalesce(s.posted, l.tips, 0)::integer as tips,
  coalesce(s.wins, l.wins, 0)::integer as wins,
  coalesce(s.losses, l.loses, 0)::integer as loses,
  coalesce(s.reputation, l.reputation, 0)::integer as reputation
from public.betai_league_users l
left join public.betai_typer_stats s
  on lower(s.email) = lower(l.email)
where l.email is not null
order by coalesce(s.profit, l.profit, 0) desc,
         coalesce(s.yield, l.yield, 0) desc,
         lower(l.email) asc
limit 100;

grant select on public.betai_league_top100 to anon, authenticated;
