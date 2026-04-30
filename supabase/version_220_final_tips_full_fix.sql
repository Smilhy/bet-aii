-- VERSION 220 - FINAL ADD TIPS FULL FIX
-- Wklej w Supabase -> SQL Editor -> Run.
create extension if not exists pgcrypto;
create table if not exists public.tips (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists league text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists odds numeric(10,2);
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_probability int;
alter table public.tips add column if not exists ai_confidence int;
alter table public.tips add column if not exists ai_score int;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric(10,2) default 0;
alter table public.tips add column if not exists status text default 'pending';
alter table public.tips add column if not exists tags text[] default '{}';
alter table public.tips add column if not exists notify_followers boolean default true;
alter table public.tips add column if not exists ai_source text;
alter table public.tips add column if not exists source text;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists live_minute int;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='tips' and column_name='match') then
    execute 'update public.tips set team_home = coalesce(team_home, split_part("match", '' vs '', 1), split_part("match", '' - '', 1), ''Mecz''), team_away = coalesce(team_away, nullif(split_part("match", '' vs '', 2), ''''), nullif(split_part("match", '' - '', 2), ''''), ''Rywal'')';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='tips' and column_name='prediction') then
    execute 'update public.tips set bet_type = coalesce(bet_type, prediction, ''Typ'')';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='tips' and column_name='username') then
    execute 'update public.tips set author_name = coalesce(author_name, username, ''Użytkownik'')';
  end if;
end $$;

update public.tips set league=coalesce(league,'Liga'), access_type=coalesce(access_type,case when is_premium then 'premium' else 'free' end,'free'), is_premium=coalesce(is_premium,access_type='premium',false), price=coalesce(price,0), odds=coalesce(odds,1.00), status=coalesce(status,'pending'), author_name=coalesce(author_name,split_part(author_email,'@',1),'Użytkownik'), author_id=coalesce(author_id,user_id), user_id=coalesce(user_id,author_id) where true;
delete from public.tips where (user_id is null and author_id is null) and (team_home is null or team_away is null or bet_type is null);
alter table public.tips alter column created_at set default now();
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
drop policy if exists "insert_tip" on public.tips;
drop policy if exists "read_tips" on public.tips;
drop policy if exists "update_own_tip" on public.tips;
drop policy if exists "delete_own_tip" on public.tips;
drop policy if exists "tips_select_all" on public.tips;
drop policy if exists "tips_insert_own" on public.tips;
drop policy if exists "tips_update_own" on public.tips;
drop policy if exists "tips_delete_own" on public.tips;
create policy "tips_select_all" on public.tips for select to anon, authenticated using (true);
create policy "tips_insert_own" on public.tips for insert to authenticated with check (auth.uid() = user_id or auth.uid() = author_id);
create policy "tips_update_own" on public.tips for update to authenticated using (auth.uid() = user_id or auth.uid() = author_id) with check (auth.uid() = user_id or auth.uid() = author_id);
create policy "tips_delete_own" on public.tips for delete to authenticated using (auth.uid() = user_id or auth.uid() = author_id);
create table if not exists public.unlocked_tips (id uuid primary key default gen_random_uuid(), user_id uuid not null, tip_id uuid not null, price numeric(10,2) default 0, created_at timestamptz not null default now(), unique(user_id, tip_id));
alter table public.unlocked_tips enable row level security;
drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
drop policy if exists "Users update own unlocked tips" on public.unlocked_tips;
drop policy if exists "unlocked_select_own" on public.unlocked_tips;
drop policy if exists "unlocked_insert_own" on public.unlocked_tips;
drop policy if exists "unlocked_update_own" on public.unlocked_tips;
create policy "unlocked_select_own" on public.unlocked_tips for select to authenticated using (auth.uid() = user_id);
create policy "unlocked_insert_own" on public.unlocked_tips for insert to authenticated with check (auth.uid() = user_id);
create policy "unlocked_update_own" on public.unlocked_tips for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_access_type on public.tips(access_type);
notify pgrst, 'reload schema';
