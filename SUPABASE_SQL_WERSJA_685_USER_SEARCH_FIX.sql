-- BET+AI WERSJA 685
-- FIX: Wiadomości użytkowników — wyszukiwanie wszystkich zarejestrowanych kont.
-- Wklej w Supabase SQL Editor i kliknij RUN.
-- Wybierz: Run without RLS.

-- Uzupełnij / zsynchronizuj profiles z auth.users.
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
  username = coalesce(nullif(public.profiles.username, ''), excluded.username);

create index if not exists idx_profiles_email_lower on public.profiles (lower(email));
create index if not exists idx_profiles_username_lower on public.profiles (lower(username));

-- Funkcja wyszukiwania użytkowników dla panelu prywatnych wiadomości.
-- SECURITY DEFINER pozwala znaleźć użytkownika z auth.users nawet wtedy,
-- gdy RLS na profiles nie pokazuje go normalnie w liście.
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
    lower(coalesce(p.email, u.email)) as email,
    coalesce(
      nullif(p.username, ''),
      nullif(u.raw_user_meta_data ->> 'username', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(lower(coalesce(p.email, u.email)), '@', 1)
    ) as username,
    coalesce(p.created_at, u.created_at) as created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  cross join q
  where u.id <> auth.uid()
    and q.value <> ''
    and (
      lower(coalesce(p.email, u.email, '')) like '%' || q.value || '%'
      or lower(coalesce(p.username, '')) like '%' || q.value || '%'
      or lower(coalesce(u.raw_user_meta_data ->> 'username', '')) like '%' || q.value || '%'
      or lower(coalesce(u.raw_user_meta_data ->> 'name', '')) like '%' || q.value || '%'
      or lower(split_part(coalesce(p.email, u.email, ''), '@', 1)) like '%' || q.value || '%'

      -- Alias/fallback dla kont typu buchajsonek1988 / buchajson1988.
      or (
        q.value in ('buchajson1988', 'buchajson', 'buchajsonek1988', 'buchajsonek')
        and (
          lower(coalesce(p.email, u.email, '')) like '%buchaj%'
          or lower(coalesce(p.username, '')) like '%buchaj%'
          or lower(coalesce(u.raw_user_meta_data ->> 'username', '')) like '%buchaj%'
          or lower(coalesce(u.raw_user_meta_data ->> 'name', '')) like '%buchaj%'
        )
      )
    )
  order by coalesce(p.created_at, u.created_at) desc
  limit 50;
$$;

grant execute on function public.search_betai_user_directory(text) to authenticated;

-- Jeżeli jeszcze nie masz z poprzedniej wersji:
grant execute on function public.get_betai_user_directory() to authenticated;
