-- SUPABASE_AVATAR_STORAGE_V17.sql
-- BetAI v17 PRO CLEAN: szybkie avatary przez Supabase Storage.
-- Uruchom w Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Tabela trzyma tylko krótki URL/preset, nie ciężki base64.
create table if not exists public.betai_user_avatars (
  user_email text primary key,
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

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

create index if not exists betai_user_avatars_updated_idx
on public.betai_user_avatars(updated_at desc);

-- Bucket avatars.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Publiczny odczyt avatarów.
drop policy if exists "Avatar images are public v17" on storage.objects;
create policy "Avatar images are public v17"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Zalogowany user może uploadować swój avatar do folderu po emailu.
drop policy if exists "Users can upload own avatar v17" on storage.objects;
create policy "Users can upload own avatar v17"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
);

drop policy if exists "Users can update own avatar file v17" on storage.objects;
create policy "Users can update own avatar file v17"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
)
with check (
  bucket_id = 'avatars'
);

drop policy if exists "Users can delete own avatar file v17" on storage.objects;
create policy "Users can delete own avatar file v17"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
);

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

select 'BetAI v17 avatar storage ready' as status;
