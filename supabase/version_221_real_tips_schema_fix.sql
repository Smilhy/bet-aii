-- =========================================
-- VERSION 221 - REAL TIPS FULL SCHEMA FIX
-- Naprawia: zapis typów, wyświetlanie w dashboardzie, FREE/PREMIUM, RLS
-- =========================================

create extension if not exists pgcrypto;

-- 1. Tabela tips - pełny schemat zgodny z frontendem i funkcją add-user-tip
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
  match_time timestamptz,
  bet_type text,
  prediction text,
  match text,
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
  live_status text,
  live_minute integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Dodaj brakujące kolumny, jeśli tabela już istnieje po starszym SQL
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists username text;
alter table public.tips add column if not exists league text;
alter table public.tips add column if not exists team_home text;
alter table public.tips add column if not exists team_away text;
alter table public.tips add column if not exists match_time timestamptz;
alter table public.tips add column if not exists bet_type text;
alter table public.tips add column if not exists prediction text;
alter table public.tips add column if not exists match text;
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
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists live_minute integer default 0;
alter table public.tips add column if not exists created_at timestamptz default now();
alter table public.tips add column if not exists updated_at timestamptz default now();

-- 3. Uzupełnij dane po starszych wersjach tabeli
update public.tips
set
  author_id = coalesce(author_id, user_id),
  user_id = coalesce(user_id, author_id),
  author_name = coalesce(author_name, username, author_email, 'Użytkownik'),
  access_type = case when coalesce(is_premium, false) = true or coalesce(price, 0) > 0 then 'premium' else coalesce(access_type, 'free') end,
  is_premium = case when coalesce(access_type, 'free') = 'premium' or coalesce(price, 0) > 0 then true else false end,
  price = coalesce(price, 0),
  status = coalesce(status, 'pending'),
  tags = coalesce(tags, '{}'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

-- Usuń tylko totalnie uszkodzone rekordy bez właściciela, bo RLS ich nie pokaże i blokują spójność
-- Jeśli chcesz zachować stare demo bez user_id, usuń tę linię przed uruchomieniem.
delete from public.tips where user_id is null and author_id is null;

-- 4. Domyślne wartości i ograniczenia bez łamania starych danych
alter table public.tips alter column user_id set default auth.uid();
alter table public.tips alter column author_id set default auth.uid();
alter table public.tips alter column access_type set default 'free';
alter table public.tips alter column is_premium set default false;
alter table public.tips alter column price set default 0;
alter table public.tips alter column status set default 'pending';
alter table public.tips alter column created_at set default now();
alter table public.tips alter column updated_at set default now();

-- 5. RLS reset
alter table public.tips enable row level security;

drop policy if exists "insert_tip" on public.tips;
drop policy if exists "read_tips" on public.tips;
drop policy if exists "read_all_relevant_tips" on public.tips;
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

-- INSERT: zalogowany user może zapisać swój typ.
create policy "insert_tip"
on public.tips
for insert
to authenticated
with check (
  coalesce(user_id, auth.uid()) = auth.uid()
  and coalesce(author_id, auth.uid()) = auth.uid()
);

-- SELECT: każdy zalogowany widzi darmowe typy i swoje premium.
create policy "read_tips"
on public.tips
for select
to authenticated
using (
  coalesce(is_premium, false) = false
  or user_id = auth.uid()
  or author_id = auth.uid()
);

create policy "update_own_tip"
on public.tips
for update
to authenticated
using (user_id = auth.uid() or author_id = auth.uid())
with check (user_id = auth.uid() or author_id = auth.uid());

create policy "delete_own_tip"
on public.tips
for delete
to authenticated
using (user_id = auth.uid() or author_id = auth.uid());

-- 6. Tabele zależne, żeby fetch dashboardu nie wysypywał się na brakujących tabelach
create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tip_id uuid not null,
  created_at timestamptz default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;
drop policy if exists "read_own_unlocked_tips" on public.unlocked_tips;
create policy "read_own_unlocked_tips"
on public.unlocked_tips
for select
to authenticated
using (user_id = auth.uid());

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
create policy "read_own_tipster_subscriptions"
on public.tipster_subscriptions
for select
to authenticated
using (user_id = auth.uid() or buyer_id = auth.uid());

-- 7. Indexy
create index if not exists idx_tips_user_id on public.tips(user_id);
create index if not exists idx_tips_author_id on public.tips(author_id);
create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_access_type on public.tips(access_type);
create index if not exists idx_tips_is_premium on public.tips(is_premium);

-- 8. Refresh PostgREST schema cache
notify pgrst, 'reload schema';
