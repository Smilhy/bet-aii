drop table if exists public.tips cascade;

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
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

alter table public.tips enable row level security;

create policy "Anyone can read tips"
on public.tips for select
to anon, authenticated
using (true);

create policy "Anyone can insert tips"
on public.tips for insert
to anon, authenticated
with check (true);
