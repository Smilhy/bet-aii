-- =========================================
-- VERSION 218 - FINALNA NAPRAWA ZAPISU TYPÓW / KUPONÓW
-- Wklej w Supabase -> SQL Editor -> Run
-- =========================================

create extension if not exists pgcrypto;

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  author_id uuid,
  author_email text,
  author_name text not null default 'Użytkownik',
  league text not null default '',
  team_home text not null default '',
  team_away text not null default '',
  match_time timestamptz,
  bet_type text not null default '',
  odds numeric(10,2) not null default 0,
  analysis text,
  ai_probability int default 0,
  ai_confidence int default 0,
  ai_score int default 0,
  ai_analysis text,
  access_type text not null default 'free',
  is_premium boolean not null default false,
  price numeric(10,2) not null default 0,
  status text not null default 'pending',
  tags text[] default '{}',
  notify_followers boolean default true
);

alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_name text not null default 'Użytkownik';
alter table public.tips add column if not exists league text not null default '';
alter table public.tips add column if not exists team_home text not null default '';
alter table public.tips add column if not exists team_away text not null default '';
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists bet_type text not null default '';
alter table public.tips add column if not exists odds numeric(10,2) not null default 0;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_probability int default 0;
alter table public.tips add column if not exists ai_confidence int default 0;
alter table public.tips add column if not exists ai_score int default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text not null default 'free';
alter table public.tips add column if not exists is_premium boolean not null default false;
alter table public.tips add column if not exists price numeric(10,2) not null default 0;
alter table public.tips add column if not exists status text not null default 'pending';
alter table public.tips add column if not exists tags text[] default '{}';
alter table public.tips add column if not exists notify_followers boolean default true;

update public.tips set user_id = author_id where user_id is null and author_id is not null;
update public.tips set author_id = user_id where author_id is null and user_id is not null;
update public.tips set access_type = case when coalesce(is_premium,false) then 'premium' else coalesce(nullif(access_type,''),'free') end;
update public.tips set is_premium = true where access_type = 'premium';
update public.tips set is_premium = false where access_type = 'free';
update public.tips set price = 0 where access_type = 'free' or price is null;
update public.tips set ai_confidence = coalesce(ai_confidence, ai_probability, 0);
update public.tips set ai_score = coalesce(ai_score, 0);
update public.tips set status = coalesce(nullif(status,''),'pending');
update public.tips set author_name = coalesce(nullif(author_name,''),'Użytkownik');

alter table public.tips enable row level security;

drop policy if exists "Anyone can read tips" on public.tips;
drop policy if exists "Authenticated users can insert tips" on public.tips;
drop policy if exists "Anyone can insert tips" on public.tips;
drop policy if exists "Users can insert their own tips" on public.tips;
drop policy if exists "Users can read tips" on public.tips;
drop policy if exists "Users can update own tips" on public.tips;
drop policy if exists "Users can delete own tips" on public.tips;
drop policy if exists "Enable insert for authenticated users" on public.tips;
drop policy if exists "Enable read access" on public.tips;
drop policy if exists "Enable update for owner" on public.tips;
drop policy if exists "Enable delete for owner" on public.tips;
drop policy if exists "tips_select_all_authenticated" on public.tips;
drop policy if exists "tips_select_all_anon" on public.tips;
drop policy if exists "tips_insert_logged_user" on public.tips;
drop policy if exists "tips_update_owner" on public.tips;
drop policy if exists "tips_delete_owner" on public.tips;

create policy "tips_select_all_authenticated"
on public.tips for select to authenticated
using (true);

create policy "tips_select_all_anon"
on public.tips for select to anon
using (access_type = 'free' or is_premium = false);

create policy "tips_insert_logged_user"
on public.tips for insert to authenticated
with check (coalesce(user_id, author_id) = auth.uid());

create policy "tips_update_owner"
on public.tips for update to authenticated
using (coalesce(user_id, author_id) = auth.uid())
with check (coalesce(user_id, author_id) = auth.uid());

create policy "tips_delete_owner"
on public.tips for delete to authenticated
using (coalesce(user_id, author_id) = auth.uid());

create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_access_type on public.tips(access_type);

select 'OK - tips table ready for free and premium inserts' as status;
