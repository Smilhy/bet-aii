-- =========================================
-- VERSION 219 - FINAL FIX DODAWANIA TYPÓW / KUPONÓW
-- BetAI: realne dane, bez fake fallback, FREE + PREMIUM
-- Wklej w Supabase -> SQL Editor -> Run
-- =========================================

create extension if not exists pgcrypto;

-- 1. Tabela zgodna z frontendem i funkcją Netlify
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  author_email text,
  author_name text not null default 'Użytkownik',
  league text not null,
  team_home text not null,
  team_away text not null,
  match_time timestamptz,
  bet_type text not null,
  odds numeric(8,2) not null,
  analysis text,
  ai_probability int,
  ai_confidence int,
  ai_score int,
  ai_analysis text,
  access_type text not null default 'free',
  is_premium boolean not null default false,
  price numeric(8,2) not null default 0,
  status text not null default 'pending',
  tags text[] default '{}',
  notify_followers boolean default true
);

-- 2. Brakujące kolumny w istniejącej bazie
alter table public.tips add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.tips add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_name text not null default 'Użytkownik';
alter table public.tips add column if not exists league text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists odds numeric(8,2);
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_probability int;
alter table public.tips add column if not exists ai_confidence int;
alter table public.tips add column if not exists ai_score int;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text not null default 'free';
alter table public.tips add column if not exists is_premium boolean not null default false;
alter table public.tips add column if not exists price numeric(8,2) not null default 0;
alter table public.tips add column if not exists status text not null default 'pending';
alter table public.tips add column if not exists tags text[] default '{}';
alter table public.tips add column if not exists notify_followers boolean default true;

-- 3. Uporządkuj stare rekordy bez kasowania prawdziwych typów
update public.tips set user_id = author_id where user_id is null and author_id is not null;
update public.tips set author_id = user_id where author_id is null and user_id is not null;
update public.tips set author_name = coalesce(nullif(author_name, ''), split_part(coalesce(author_email, 'Użytkownik'), '@', 1), 'Użytkownik');
update public.tips set access_type = case when is_premium = true or access_type = 'premium' or price > 0 then 'premium' else 'free' end;
update public.tips set is_premium = case when access_type = 'premium' or price > 0 then true else false end;
update public.tips set price = 0 where access_type = 'free' or price is null;
update public.tips set status = 'pending' where status is null or status not in ('pending','won','lost','void');
update public.tips set tags = '{}' where tags is null;

-- 4. Luźne, produkcyjne constrainty: nie blokują przez stare NULL-e user_id
alter table public.tips alter column author_name set default 'Użytkownik';
alter table public.tips alter column access_type set default 'free';
alter table public.tips alter column is_premium set default false;
alter table public.tips alter column price set default 0;
alter table public.tips alter column status set default 'pending';
alter table public.tips alter column created_at set default now();

-- 5. RLS: pozwala zapisywać zalogowanym; odczyt pokazuje realne dane z bazy
alter table public.tips enable row level security;

drop policy if exists "Anyone can read tips" on public.tips;
drop policy if exists "Authenticated users can insert tips" on public.tips;
drop policy if exists "Anyone can insert tips" on public.tips;
drop policy if exists "insert_tip" on public.tips;
drop policy if exists "read_tips" on public.tips;
drop policy if exists "update_own_tip" on public.tips;
drop policy if exists "delete_own_tip" on public.tips;
drop policy if exists "Enable insert for authenticated users" on public.tips;
drop policy if exists "Enable read access" on public.tips;
drop policy if exists "Enable update for owner" on public.tips;
drop policy if exists "Enable delete for owner" on public.tips;

create policy "tips_read_real_feed"
on public.tips
for select
to anon, authenticated
using (true);

create policy "tips_insert_logged_user"
on public.tips
for insert
to authenticated
with check (
  auth.uid() is not null
  and (
    author_id is null or author_id = auth.uid()
  )
  and (
    user_id is null or user_id = auth.uid()
  )
);

create policy "tips_update_owner"
on public.tips
for update
to authenticated
using (auth.uid() = coalesce(user_id, author_id))
with check (auth.uid() = coalesce(user_id, author_id));

create policy "tips_delete_owner"
on public.tips
for delete
to authenticated
using (auth.uid() = coalesce(user_id, author_id));

-- 6. Tabela odblokowanych premium typów, jeśli jej brakuje
create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;
drop policy if exists "Users can read own unlocked tips" on public.unlocked_tips;
create policy "Users can read own unlocked tips"
on public.unlocked_tips for select
to authenticated
using (auth.uid() = user_id);

-- 7. Indexy
create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_access_type on public.tips(access_type);
create index if not exists idx_tips_is_premium on public.tips(is_premium);

-- =========================================
-- DONE: po uruchomieniu SQL wrzuć paczkę wersja_219.zip
-- =========================================
