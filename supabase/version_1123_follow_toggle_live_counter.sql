-- supabase/version_1123_follow_toggle_live_counter.sql
-- Top typerzy: trwałe obserwowanie + publiczny licznik obserwujących.
-- Odpal raz w Supabase SQL Editor, jeśli tabela follow nie była jeszcze tworzona albo licznik ma zostać po odświeżeniu.

create extension if not exists pgcrypto;

create table if not exists public.betai_tipster_follow_keys_v1033 (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade,
  follower_email text,
  tipster_id uuid,
  tipster_key text not null,
  tipster_name text,
  tipster_email text,
  created_at timestamptz not null default now()
);

alter table public.betai_tipster_follow_keys_v1033 add column if not exists follower_id uuid;
alter table public.betai_tipster_follow_keys_v1033 add column if not exists follower_email text;
alter table public.betai_tipster_follow_keys_v1033 add column if not exists tipster_id uuid;
alter table public.betai_tipster_follow_keys_v1033 add column if not exists tipster_key text;
alter table public.betai_tipster_follow_keys_v1033 add column if not exists tipster_name text;
alter table public.betai_tipster_follow_keys_v1033 add column if not exists tipster_email text;
alter table public.betai_tipster_follow_keys_v1033 add column if not exists created_at timestamptz not null default now();

update public.betai_tipster_follow_keys_v1033
set
  follower_email = lower(trim(coalesce(follower_email, ''))),
  tipster_key = lower(trim(coalesce(tipster_key, tipster_name, tipster_email, ''))),
  tipster_email = lower(trim(coalesce(tipster_email, '')))
where true;

delete from public.betai_tipster_follow_keys_v1033
where tipster_key is null or trim(tipster_key) = '';

create unique index if not exists betai_tipster_follow_keys_v1033_uidx
on public.betai_tipster_follow_keys_v1033(follower_id, tipster_key);

create index if not exists betai_tipster_follow_keys_v1033_key_idx
on public.betai_tipster_follow_keys_v1033(lower(tipster_key));

create index if not exists betai_tipster_follow_keys_v1033_name_idx
on public.betai_tipster_follow_keys_v1033(lower(tipster_name));

alter table public.betai_tipster_follow_keys_v1033 enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_tipster_follow_keys_v1033'
      and policyname='betai_tipster_follow_keys_select_own_v1033'
  ) then
    create policy betai_tipster_follow_keys_select_own_v1033
    on public.betai_tipster_follow_keys_v1033
    for select
    using (
      auth.uid() = follower_id
      or lower(follower_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_tipster_follow_keys_v1033'
      and policyname='betai_tipster_follow_keys_insert_own_v1033'
  ) then
    create policy betai_tipster_follow_keys_insert_own_v1033
    on public.betai_tipster_follow_keys_v1033
    for insert
    with check (
      auth.uid() = follower_id
      or lower(follower_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_tipster_follow_keys_v1033'
      and policyname='betai_tipster_follow_keys_delete_own_v1033'
  ) then
    create policy betai_tipster_follow_keys_delete_own_v1033
    on public.betai_tipster_follow_keys_v1033
    for delete
    using (
      auth.uid() = follower_id
      or lower(follower_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

-- Publiczna funkcja zwraca tylko liczbę obserwujących po kluczach typera.
-- Nie pokazuje listy użytkowników, tylko agregat/licznik.
create or replace function public.betai_get_tipster_follow_stats_v1123()
returns table(tipster_key text, followers bigint)
language sql
security definer
set search_path = public
as $$
  with raw_keys as (
    select
      lower(trim(tipster_id::text)) as key,
      coalesce(follower_id::text, lower(trim(follower_email)), id::text) as follower_key
    from public.betai_tipster_follow_keys_v1033
    where tipster_id is not null

    union all

    select
      lower(trim(tipster_key)) as key,
      coalesce(follower_id::text, lower(trim(follower_email)), id::text) as follower_key
    from public.betai_tipster_follow_keys_v1033
    where tipster_key is not null and trim(tipster_key) <> ''

    union all

    select
      lower(trim(tipster_name)) as key,
      coalesce(follower_id::text, lower(trim(follower_email)), id::text) as follower_key
    from public.betai_tipster_follow_keys_v1033
    where tipster_name is not null and trim(tipster_name) <> ''

    union all

    select
      lower(trim(tipster_email)) as key,
      coalesce(follower_id::text, lower(trim(follower_email)), id::text) as follower_key
    from public.betai_tipster_follow_keys_v1033
    where tipster_email is not null and trim(tipster_email) <> ''
  ), clean as (
    select key, follower_key
    from raw_keys
    where key is not null and key <> '' and follower_key is not null and follower_key <> ''
  )
  select key as tipster_key, count(distinct follower_key)::bigint as followers
  from clean
  group by key;
$$;

grant execute on function public.betai_get_tipster_follow_stats_v1123() to anon, authenticated;

select 'v1123 follow toggle live counter ready' as status;
