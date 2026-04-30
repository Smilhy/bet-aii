-- Uruchom w Supabase SQL Editor
create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  created_at timestamptz default now()
);

create table if not exists public.presence_heartbeats (
  user_id uuid primary key,
  email text,
  last_seen timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.presence_heartbeats enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select to anon, authenticated using (true);

drop policy if exists "profiles_insert_all" on public.profiles;
create policy "profiles_insert_all" on public.profiles for insert to anon, authenticated with check (true);

drop policy if exists "profiles_update_all" on public.profiles;
create policy "profiles_update_all" on public.profiles for update to anon, authenticated using (true) with check (true);

drop policy if exists "presence_select_all" on public.presence_heartbeats;
create policy "presence_select_all" on public.presence_heartbeats for select to anon, authenticated using (true);

drop policy if exists "presence_insert_all" on public.presence_heartbeats;
create policy "presence_insert_all" on public.presence_heartbeats for insert to anon, authenticated with check (true);

drop policy if exists "presence_update_all" on public.presence_heartbeats;
create policy "presence_update_all" on public.presence_heartbeats for update to anon, authenticated using (true) with check (true);
