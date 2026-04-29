-- VERSION 222 - FINAL SAVE + MESSAGE FIX
-- Wklej CAŁOŚĆ w Supabase -> SQL Editor -> Run. Nie wklejaj znaków ```.

create extension if not exists pgcrypto;

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  user_id uuid,
  author_email text,
  author_name text,
  username text,
  league text,
  team_home text,
  team_away text,
  match text,
  match_time timestamptz,
  bet_type text,
  prediction text,
  odds numeric,
  analysis text,
  ai_probability integer default 0,
  ai_confidence integer default 0,
  ai_score integer default 0,
  ai_analysis text,
  access_type text default 'free',
  is_premium boolean default false,
  price numeric default 0,
  status text default 'pending',
  result_status text,
  profit numeric default 0,
  tags text[] default '{}',
  notify_followers boolean default true,
  ai_source text,
  source text,
  sport text,
  external_fixture_id text,
  kickoff_time timestamptz,
  live_status text,
  live_minute integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists username text;
alter table public.tips add column if not exists league text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match text;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists prediction text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists ai_probability integer default 0;
alter table public.tips add column if not exists ai_confidence integer default 0;
alter table public.tips add column if not exists ai_score integer default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists access_type text default 'free';
alter table public.tips add column if not exists is_premium boolean default false;
alter table public.tips add column if not exists price numeric default 0;
alter table public.tips add column if not exists status text default 'pending';
alter table public.tips add column if not exists result_status text;
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists tags text[] default '{}';
alter table public.tips add column if not exists notify_followers boolean default true;
alter table public.tips add column if not exists ai_source text;
alter table public.tips add column if not exists source text;
alter table public.tips add column if not exists sport text;
alter table public.tips add column if not exists external_fixture_id text;
alter table public.tips add column if not exists kickoff_time timestamptz;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists live_minute integer default 0;
alter table public.tips add column if not exists created_at timestamptz default now();
alter table public.tips add column if not exists updated_at timestamptz default now();

update public.tips
set
  author_id = coalesce(author_id, user_id),
  user_id = coalesce(user_id, author_id),
  author_name = coalesce(nullif(author_name,''), nullif(username,''), split_part(coalesce(author_email,''),'@',1), 'Użytkownik'),
  username = coalesce(nullif(username,''), nullif(author_name,''), split_part(coalesce(author_email,''),'@',1), 'Użytkownik'),
  team_home = coalesce(nullif(team_home,''), nullif(split_part(match, ' vs ', 1), ''), nullif(split_part(match, ' - ', 1), ''), 'Drużyna 1'),
  team_away = coalesce(nullif(team_away,''), nullif(split_part(match, ' vs ', 2), ''), nullif(split_part(match, ' - ', 2), ''), 'Drużyna 2'),
  bet_type = coalesce(nullif(bet_type,''), nullif(prediction,''), 'Typ'),
  prediction = coalesce(nullif(prediction,''), nullif(bet_type,''), 'Typ'),
  match = coalesce(nullif(match,''), coalesce(team_home,'Drużyna 1') || ' vs ' || coalesce(team_away,'Drużyna 2')),
  access_type = case when coalesce(is_premium,false) = true or coalesce(price,0) > 0 or access_type = 'premium' then 'premium' else 'free' end,
  is_premium = case when coalesce(is_premium,false) = true or coalesce(price,0) > 0 or access_type = 'premium' then true else false end,
  price = coalesce(price, 0),
  odds = coalesce(odds, 0),
  status = coalesce(nullif(status,''), 'pending'),
  tags = coalesce(tags, '{}'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.tips alter column author_id set default auth.uid();
alter table public.tips alter column user_id set default auth.uid();
alter table public.tips alter column author_name set default 'Użytkownik';
alter table public.tips alter column username set default 'Użytkownik';
alter table public.tips alter column league set default 'Liga';
alter table public.tips alter column team_home set default 'Drużyna 1';
alter table public.tips alter column team_away set default 'Drużyna 2';
alter table public.tips alter column bet_type set default 'Typ';
alter table public.tips alter column prediction set default 'Typ';
alter table public.tips alter column odds set default 0;
alter table public.tips alter column access_type set default 'free';
alter table public.tips alter column is_premium set default false;
alter table public.tips alter column price set default 0;
alter table public.tips alter column status set default 'pending';
alter table public.tips alter column tags set default '{}';
alter table public.tips alter column notify_followers set default true;
alter table public.tips alter column created_at set default now();
alter table public.tips alter column updated_at set default now();

alter table public.tips enable row level security;

drop policy if exists "Anyone can read tips" on public.tips;
drop policy if exists "Authenticated users can insert tips" on public.tips;
drop policy if exists "Anyone can insert tips" on public.tips;
drop policy if exists "insert_tip" on public.tips;
drop policy if exists "read_tips" on public.tips;
drop policy if exists "read_all_relevant_tips" on public.tips;
drop policy if exists "tips_insert_logged_user" on public.tips;
drop policy if exists "tips_read_real_feed" on public.tips;
drop policy if exists "update_own_tip" on public.tips;
drop policy if exists "delete_own_tip" on public.tips;
drop policy if exists "Enable insert for authenticated users" on public.tips;
drop policy if exists "Enable read access" on public.tips;
drop policy if exists "Enable update for owner" on public.tips;
drop policy if exists "Enable delete for owner" on public.tips;
drop policy if exists "Users can insert their own tips" on public.tips;
drop policy if exists "Users can read tips" on public.tips;
drop policy if exists "Users can update own tips" on public.tips;
drop policy if exists "Users can delete own tips" on public.tips;

create policy "tips_read_feed_v222" on public.tips for select to authenticated using (true);

create policy "tips_insert_v222"
on public.tips
for insert
to authenticated
with check (
  auth.uid() is not null
  and coalesce(user_id, auth.uid()) = auth.uid()
  and coalesce(author_id, auth.uid()) = auth.uid()
);

create policy "tips_update_own_v222" on public.tips for update to authenticated using (user_id = auth.uid() or author_id = auth.uid()) with check (user_id = auth.uid() or author_id = auth.uid());
create policy "tips_delete_own_v222" on public.tips for delete to authenticated using (user_id = auth.uid() or author_id = auth.uid());

create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tip_id uuid not null,
  price numeric default 0,
  created_at timestamptz default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;
drop policy if exists "read_own_unlocked_tips" on public.unlocked_tips;
drop policy if exists "insert_own_unlocked_tips" on public.unlocked_tips;
create policy "read_own_unlocked_tips" on public.unlocked_tips for select to authenticated using (user_id = auth.uid());
create policy "insert_own_unlocked_tips" on public.unlocked_tips for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.tipster_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  buyer_id uuid,
  tipster_id uuid not null,
  status text default 'active',
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, tipster_id)
);

alter table public.tipster_subscriptions enable row level security;
drop policy if exists "read_own_tipster_subscriptions" on public.tipster_subscriptions;
create policy "read_own_tipster_subscriptions" on public.tipster_subscriptions for select to authenticated using (user_id = auth.uid() or buyer_id = auth.uid());

create index if not exists idx_tips_user_id_v222 on public.tips(user_id);
create index if not exists idx_tips_author_id_v222 on public.tips(author_id);
create index if not exists idx_tips_created_at_v222 on public.tips(created_at desc);
create index if not exists idx_tips_access_type_v222 on public.tips(access_type);
create index if not exists idx_tips_is_premium_v222 on public.tips(is_premium);

notify pgrst, 'reload schema';
