-- BetAI wersja 217 — twarda naprawa zapisu kuponów/typów FREE + PREMIUM
-- Wklej w Supabase -> SQL Editor -> Run.
-- Naprawia: brak zapisu, blokady RLS, brakujące kolumny, problemy z user_id/profiles.

create extension if not exists pgcrypto;

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid,
  author_name text not null default 'Użytkownik',
  league text not null default '',
  team_home text not null default '',
  team_away text not null default '',
  match_time timestamptz,
  bet_type text not null default '',
  odds numeric(10,2) not null default 0,
  analysis text,
  ai_probability int default 0,
  access_type text not null default 'free',
  price numeric(10,2) not null default 0,
  status text not null default 'pending',
  tags text[] default '{}',
  notify_followers boolean default true
);

alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists author_name text default 'Użytkownik';
alter table public.tips add column if not exists league text default '';
alter table public.tips add column if not exists team_home text default '';
alter table public.tips add column if not exists team_away text default '';
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists bet_type text default '';
alter table public.tips add column if not exists odds numeric(10,2) default 0;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_probability int default 0;
alter table public.tips add column if not exists ai_confidence int default 0;
alter table public.tips add column if not exists ai_score int default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric(10,2) default 0;
alter table public.tips add column if not exists status text default 'pending';
alter table public.tips add column if not exists tags text[] default '{}';
alter table public.tips add column if not exists notify_followers boolean default true;

-- Zdejmujemy potencjalne blokady NOT NULL na kolumnach dodatkowych.
alter table public.tips alter column user_id drop not null;
alter table public.tips alter column author_id drop not null;
alter table public.tips alter column author_email drop not null;
alter table public.tips alter column analysis drop not null;
alter table public.tips alter column ai_confidence drop not null;
alter table public.tips alter column ai_score drop not null;
alter table public.tips alter column ai_analysis drop not null;
alter table public.tips alter column tags drop not null;
alter table public.tips alter column notify_followers drop not null;

update public.tips
set
  author_name = coalesce(nullif(author_name, ''), 'Użytkownik'),
  league = coalesce(league, ''),
  team_home = coalesce(team_home, ''),
  team_away = coalesce(team_away, ''),
  bet_type = coalesce(bet_type, ''),
  odds = coalesce(odds, 0),
  ai_probability = coalesce(ai_probability, ai_confidence, 0),
  ai_confidence = coalesce(ai_confidence, ai_probability, 0),
  ai_score = coalesce(ai_score, 0),
  access_type = case when access_type = 'premium' or is_premium is true then 'premium' else 'free' end,
  is_premium = case when access_type = 'premium' or is_premium is true then true else false end,
  price = case when access_type = 'premium' or is_premium is true then coalesce(price, 0) else 0 end,
  status = coalesce(nullif(status, ''), 'pending'),
  tags = coalesce(tags, '{}'),
  notify_followers = coalesce(notify_followers, true);

alter table public.tips alter column author_name set default 'Użytkownik';
alter table public.tips alter column league set default '';
alter table public.tips alter column team_home set default '';
alter table public.tips alter column team_away set default '';
alter table public.tips alter column bet_type set default '';
alter table public.tips alter column odds set default 0;
alter table public.tips alter column ai_probability set default 0;
alter table public.tips alter column ai_confidence set default 0;
alter table public.tips alter column ai_score set default 0;
alter table public.tips alter column access_type set default 'free';
alter table public.tips alter column is_premium set default false;
alter table public.tips alter column price set default 0;
alter table public.tips alter column status set default 'pending';
alter table public.tips alter column tags set default '{}';
alter table public.tips alter column notify_followers set default true;

alter table public.tips enable row level security;

drop policy if exists "Anyone can read tips" on public.tips;
drop policy if exists "Authenticated users can insert tips" on public.tips;
drop policy if exists "Anyone can insert tips" on public.tips;
drop policy if exists "Users can insert their own tips" on public.tips;
drop policy if exists "Users can read tips" on public.tips;
drop policy if exists "Users can update own tips" on public.tips;
drop policy if exists "Users can delete own tips" on public.tips;
drop policy if exists "BetAI read tips feed" on public.tips;
drop policy if exists "BetAI users insert own tips" on public.tips;
drop policy if exists "BetAI users update own tips" on public.tips;
drop policy if exists "BetAI insert free premium tips" on public.tips;
drop policy if exists "BetAI update own tips" on public.tips;
drop policy if exists "BetAI v217 read all tips" on public.tips;
drop policy if exists "BetAI v217 authenticated insert tips" on public.tips;
drop policy if exists "BetAI v217 owner update tips" on public.tips;
drop policy if exists "BetAI v217 owner delete tips" on public.tips;

create policy "BetAI v217 read all tips"
on public.tips
for select
to anon, authenticated
using (true);

create policy "BetAI v217 authenticated insert tips"
on public.tips
for insert
to authenticated
with check (true);

create policy "BetAI v217 owner update tips"
on public.tips
for update
to authenticated
using (author_id = auth.uid() or user_id = auth.uid())
with check (author_id = auth.uid() or user_id = auth.uid());

create policy "BetAI v217 owner delete tips"
on public.tips
for delete
to authenticated
using (author_id = auth.uid() or user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.tips to anon, authenticated;
grant insert, update, delete on public.tips to authenticated;

create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_access_type on public.tips(access_type);
