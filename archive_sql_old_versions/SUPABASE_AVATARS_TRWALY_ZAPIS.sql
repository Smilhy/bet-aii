-- SQL_AVATARS_SYNC.sql
-- BetAI avatars - trwały zapis w Supabase po emailu
-- Uruchom w Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.betai_user_avatars (
  user_email text primary key,
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists betai_user_avatars_updated_idx
on public.betai_user_avatars(updated_at desc);

alter table public.betai_user_avatars enable row level security;

drop policy if exists "betai avatars select authenticated" on public.betai_user_avatars;
create policy "betai avatars select authenticated"
on public.betai_user_avatars
for select
to authenticated
using (true);

drop policy if exists "betai avatars insert own" on public.betai_user_avatars;
create policy "betai avatars insert own"
on public.betai_user_avatars
for insert
to authenticated
with check (lower(auth.email()) = lower(user_email));

drop policy if exists "betai avatars update own" on public.betai_user_avatars;
create policy "betai avatars update own"
on public.betai_user_avatars
for update
to authenticated
using (lower(auth.email()) = lower(user_email))
with check (lower(auth.email()) = lower(user_email));

drop policy if exists "betai avatars delete own" on public.betai_user_avatars;
create policy "betai avatars delete own"
on public.betai_user_avatars
for delete
to authenticated
using (lower(auth.email()) = lower(user_email));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'betai_user_avatars'
  ) then
    alter publication supabase_realtime add table public.betai_user_avatars;
  end if;
end $$;

select * from public.betai_user_avatars limit 5;
