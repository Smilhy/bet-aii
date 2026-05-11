-- BETAI SQL 846 — stabilne nicki w prywatnych wiadomościach
-- Naprawa: panel DM nie może wracać do nazw typu "Użytkownik 4C913A".
-- Uruchom w Supabase SQL Editor.

-- 1) Dopilnuj, że profiles ma podstawowe dane wszystkich kont.
alter table public.profiles
  add column if not exists email text,
  add column if not exists username text,
  add column if not exists created_at timestamptz not null default now();

insert into public.profiles (id, email, username, created_at)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(lower(u.email), '@', 1)
  ),
  u.created_at
from auth.users u
on conflict (id) do update
set
  email = coalesce(nullif(public.profiles.email, ''), excluded.email),
  username = case
    when nullif(public.profiles.username, '') is not null
      and lower(public.profiles.username) not in ('user','uzytkownik','użytkownik','guest','gość','gosc')
      then public.profiles.username
    else excluded.username
  end;

create index if not exists idx_profiles_email_lower on public.profiles (lower(email));
create index if not exists idx_profiles_username_lower on public.profiles (lower(username));

-- 2) Katalog użytkowników — zawsze bierze stabilny username, a jeśli go brak, login z emaila.
create or replace function public.get_betai_user_directory()
returns table (
  id uuid,
  email text,
  username text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    lower(coalesce(nullif(p.email, ''), u.email)) as email,
    coalesce(
      nullif(p.username, ''),
      nullif(u.raw_user_meta_data ->> 'username', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(lower(coalesce(nullif(p.email, ''), u.email)), '@', 1)
    ) as username,
    coalesce(p.created_at, u.created_at) as created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id <> auth.uid()
  order by coalesce(p.created_at, u.created_at) desc;
$$;

grant execute on function public.get_betai_user_directory() to authenticated;

-- 3) Resolver po UUID dla istniejących rozmów.
-- To jest kluczowa naprawa, gdy direct_messages ma rozmowy,
-- ale zwykły SELECT z profiles zostanie przycięty przez RLS.
create or replace function public.resolve_betai_user_directory(p_user_ids uuid[])
returns table (
  id uuid,
  email text,
  username text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    lower(coalesce(nullif(p.email, ''), u.email)) as email,
    coalesce(
      nullif(p.username, ''),
      nullif(u.raw_user_meta_data ->> 'username', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(lower(coalesce(nullif(p.email, ''), u.email)), '@', 1)
    ) as username,
    coalesce(p.created_at, u.created_at) as created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p_user_ids is not null
    and u.id = any(p_user_ids)
    and u.id <> auth.uid();
$$;

grant execute on function public.resolve_betai_user_directory(uuid[]) to authenticated;

-- 4) Wyszukiwanie katalogu też ma zwracać stabilne nazwy.
create or replace function public.search_betai_user_directory(p_query text)
returns table (
  id uuid,
  email text,
  username text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with q as (
    select lower(trim(coalesce(p_query, ''))) as value
  )
  select
    u.id,
    lower(coalesce(nullif(p.email, ''), u.email)) as email,
    coalesce(
      nullif(p.username, ''),
      nullif(u.raw_user_meta_data ->> 'username', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(lower(coalesce(nullif(p.email, ''), u.email)), '@', 1)
    ) as username,
    coalesce(p.created_at, u.created_at) as created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  cross join q
  where u.id <> auth.uid()
    and q.value <> ''
    and (
      lower(coalesce(nullif(p.email, ''), u.email, '')) like '%' || q.value || '%'
      or lower(coalesce(p.username, '')) like '%' || q.value || '%'
      or lower(coalesce(u.raw_user_meta_data ->> 'username', '')) like '%' || q.value || '%'
      or lower(coalesce(u.raw_user_meta_data ->> 'name', '')) like '%' || q.value || '%'
      or lower(split_part(coalesce(nullif(p.email, ''), u.email, ''), '@', 1)) like '%' || q.value || '%'
    )
  order by coalesce(p.created_at, u.created_at) desc
  limit 50;
$$;

grant execute on function public.search_betai_user_directory(text) to authenticated;
