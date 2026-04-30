-- =========================================
-- BETAI LEAGUES V189 REAL USERS + CLEAN RANKING
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  created_at timestamptz default now()
);

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

alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.betai_typer_stats add column if not exists posted integer not null default 0;
alter table public.betai_typer_stats add column if not exists wins integer not null default 0;
alter table public.betai_typer_stats add column if not exists losses integer not null default 0;
alter table public.betai_typer_stats add column if not exists open integer not null default 0;
alter table public.betai_typer_stats add column if not exists yield numeric(12,2) not null default 0;
alter table public.betai_typer_stats add column if not exists profit numeric(12,2) not null default 0;
alter table public.betai_typer_stats add column if not exists reputation integer not null default 0;
alter table public.betai_typer_stats add column if not exists created_at timestamptz not null default now();
alter table public.betai_typer_stats add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;
alter table public.betai_typer_stats enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select to anon, authenticated using (true);

drop policy if exists "profiles_insert_all" on public.profiles;
create policy "profiles_insert_all" on public.profiles for insert to anon, authenticated with check (true);

drop policy if exists "profiles_update_all" on public.profiles;
create policy "profiles_update_all" on public.profiles for update to anon, authenticated using (true) with check (true);

drop policy if exists "betai_typer_stats_select_all" on public.betai_typer_stats;
create policy "betai_typer_stats_select_all" on public.betai_typer_stats for select to anon, authenticated using (true);

drop policy if exists "betai_typer_stats_insert_all" on public.betai_typer_stats;
create policy "betai_typer_stats_insert_all" on public.betai_typer_stats for insert to anon, authenticated with check (true);

drop policy if exists "betai_typer_stats_update_all" on public.betai_typer_stats;
create policy "betai_typer_stats_update_all" on public.betai_typer_stats for update to anon, authenticated using (true) with check (true);

create or replace function public.betai_sync_ranking_user(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    return;
  end if;

  insert into public.profiles (id, email, created_at)
  values (p_user_id, v_email, now())
  on conflict (id) do update
    set email = excluded.email;

  insert into public.betai_typer_stats (email, posted, wins, losses, open, yield, profit, reputation, created_at, updated_at)
  values (v_email, 0, 0, 0, 0, 0, 0, 0, now(), now())
  on conflict (email) do nothing;
end;
$$;

create or replace function public.betai_handle_new_ranking_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.betai_sync_ranking_user(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists trg_betai_handle_new_ranking_user on auth.users;
create trigger trg_betai_handle_new_ranking_user
after insert on auth.users
for each row execute function public.betai_handle_new_ranking_user();

insert into public.profiles (id, email, created_at)
select u.id, lower(u.email), coalesce(u.created_at, now())
from auth.users u
where u.email is not null
on conflict (id) do update
set email = excluded.email;

insert into public.betai_typer_stats (email, posted, wins, losses, open, yield, profit, reputation, created_at, updated_at)
select lower(u.email), 0, 0, 0, 0, 0, 0, 0, now(), now()
from auth.users u
where u.email is not null
on conflict (email) do nothing;
