-- =========================
-- VERSION 121 — PUBLIC PROFILE LINK + SHARE
-- =========================
-- Publiczne profile tipsterów: /tipster/username
-- Bezpieczny patch: dodaje kolumny, indeksy i automatyczny slug.

alter table public.profiles
add column if not exists username text;

alter table public.profiles
add column if not exists public_slug text;

create or replace function public.normalize_public_slug(input_text text)
returns text
language sql
immutable
as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

-- Ustaw username/public_slug dla istniejących profili, jeśli puste.
update public.profiles
set username = coalesce(
  nullif(username, ''),
  public.normalize_public_slug(split_part(coalesce(email, id::text), '@', 1)),
  replace(id::text, '-', '')
)
where username is null or username = '';

update public.profiles
set public_slug = coalesce(
  nullif(public_slug, ''),
  public.normalize_public_slug(username),
  public.normalize_public_slug(split_part(coalesce(email, id::text), '@', 1)),
  replace(id::text, '-', '')
)
where public_slug is null or public_slug = '';

-- Rozwiąż ewentualne duplikaty przez dopięcie krótkiego ID.
with duplicated as (
  select id, public_slug, row_number() over (partition by public_slug order by created_at nulls last, id) as rn
  from public.profiles
  where public_slug is not null
)
update public.profiles p
set public_slug = left(d.public_slug || '-' || replace(p.id::text, '-', ''), 48)
from duplicated d
where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_public_slug_unique
on public.profiles(public_slug)
where public_slug is not null;

create index if not exists profiles_username_idx
on public.profiles(username);

create or replace function public.ensure_profile_public_slug()
returns trigger
language plpgsql
as $$
begin
  if new.username is null or new.username = '' then
    new.username := coalesce(
      public.normalize_public_slug(split_part(coalesce(new.email, new.id::text), '@', 1)),
      replace(new.id::text, '-', '')
    );
  else
    new.username := public.normalize_public_slug(new.username);
  end if;

  if new.public_slug is null or new.public_slug = '' then
    new.public_slug := coalesce(
      public.normalize_public_slug(new.username),
      public.normalize_public_slug(split_part(coalesce(new.email, new.id::text), '@', 1)),
      replace(new.id::text, '-', '')
    );
  else
    new.public_slug := public.normalize_public_slug(new.public_slug);
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_ensure_profile_public_slug on public.profiles;

create trigger trigger_ensure_profile_public_slug
before insert or update of username, public_slug, email on public.profiles
for each row
execute function public.ensure_profile_public_slug();

-- Publiczne odczyty profili pod landing tipstera.
alter table public.profiles enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
on public.profiles
for select
using (true);
