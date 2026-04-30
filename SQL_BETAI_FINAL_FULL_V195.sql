-- =========================================
-- BETAI FINAL FULL V195
-- League users + ranking access + auto sync
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.betai_league_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
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

drop policy if exists "Enable read for all users" on public.betai_league_users;
drop policy if exists "Allow read betai_league_users" on public.betai_league_users;

delete from public.betai_league_users
where lower(coalesce(email,'')) in (
  'betshark@betai.com',
  'valuehunter@betai.com',
  'goalmachine@betai.com',
  'marioexpert@betai.com',
  'underdogking@betai.com',
  'nightodds@betai.com'
);

insert into public.betai_league_users (user_id, email, nickname, profit, yield, tips, wins, loses, reputation)
select
  u.id,
  lower(u.email),
  split_part(lower(u.email), '@', 1),
  0,0,0,0,0,0
from auth.users u
where u.email is not null
on conflict (email) do update
set user_id = excluded.user_id,
    nickname = excluded.nickname,
    updated_at = now();

create or replace function public.betai_add_user_to_league()
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
    0,0,0,0,0,0
  )
  on conflict (email) do update
  set user_id = excluded.user_id,
      nickname = excluded.nickname,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_league on auth.users;
create trigger on_auth_user_created_league
after insert on auth.users
for each row execute procedure public.betai_add_user_to_league();

drop view if exists public.betai_league_top100;
create view public.betai_league_top100 as
select
  email,
  nickname,
  profit,
  yield,
  tips,
  wins,
  loses,
  reputation
from public.betai_league_users
order by profit desc, reputation desc, email asc
limit 100;

grant select on public.betai_league_users to anon, authenticated;
grant select on public.betai_league_top100 to anon, authenticated;
