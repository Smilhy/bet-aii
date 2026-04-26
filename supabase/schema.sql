-- Bet+AI schema v20
-- UWAGA: jeśli masz już tabelę tips i dane testowe, ten skrypt zachowuje tabelę i dodaje brakujące kolumny.
-- Wklej w Supabase SQL Editor i kliknij RUN.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  role text not null default 'user' check (role in ('user', 'tipster', 'admin')),
  wallet numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles readable by owner" on public.profiles;
create policy "Profiles readable by owner"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Profiles insert owner" on public.profiles;
create policy "Profiles insert owner"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Profiles update owner" on public.profiles;
create policy "Profiles update owner"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'AdrianNowak',
  league text not null,
  team_home text not null,
  team_away text not null,
  match_time timestamptz,
  bet_type text not null,
  odds numeric(8,2) not null,
  analysis text,
  ai_probability int check (ai_probability >= 0 and ai_probability <= 100),
  access_type text not null default 'free' check (access_type in ('free', 'premium')),
  price numeric(8,2) default 0,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  tags text[] default '{}',
  notify_followers boolean default true
);

alter table public.tips add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.tips enable row level security;

drop policy if exists "Anyone can read tips" on public.tips;
create policy "Anyone can read tips"
on public.tips for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert tips" on public.tips;
create policy "Authenticated users can insert tips"
on public.tips for insert
to authenticated
with check (true);

drop policy if exists "Anyone can insert tips" on public.tips;
create policy "Anyone can insert tips"
on public.tips for insert
to anon, authenticated
with check (true);

create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips for insert
to authenticated
with check (auth.uid() = user_id);
