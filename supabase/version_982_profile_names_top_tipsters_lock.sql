-- WERSJA 982 — NAPRAWA NAZW PROFILI W TOP TYPERACH + BLOKADA NA STAŁE
-- Uruchom w Supabase SQL Editor.
--
-- Problem:
-- po resecie ranking może mieć staty 0, ale nazwy nie mogą pokazywać "Użytkownik",
-- jeśli konto ma email/public_slug/username w auth albo profiles.
--
-- Ten SQL:
-- 1. Uzupełnia profiles.email z auth.users, jeśli brakuje.
-- 2. Uzupełnia username/public_slug z metadanych auth albo z emaila.
-- 3. Blokuje przyszłe zapisanie username='user/użytkownik', gdy można ustalić prawdziwą nazwę.
-- 4. Aktualizuje funkcję publiczną profili, żeby frontend dostał public_slug/email/username.

begin;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Uzupełnij email/nazwy z auth.users, jeśli profiles.id = auth.users.id.
update public.profiles p
set
  email = coalesce(nullif(p.email, ''), u.email),
  username = case
    when lower(coalesce(p.username, '')) in ('', 'user', 'użytkownik', 'uzytkownik')
    then coalesce(
      nullif(p.public_slug, ''),
      nullif(u.raw_user_meta_data->>'username', ''),
      nullif(u.raw_user_meta_data->>'name', ''),
      nullif(split_part(u.email, '@', 1), ''),
      p.username
    )
    else p.username
  end,
  public_slug = coalesce(
    nullif(p.public_slug, ''),
    nullif(u.raw_user_meta_data->>'username', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    nullif(split_part(coalesce(p.email, u.email), '@', 1), '')
  ),
  avatar_url = coalesce(
    nullif(p.avatar_url, ''),
    nullif(u.raw_user_meta_data->>'avatar_url', ''),
    nullif(u.raw_user_meta_data->>'picture', '')
  ),
  updated_at = now()
from auth.users u
where p.id = u.id;

-- Dodatkowo napraw profile bez joinu, jeśli mają email.
update public.profiles
set
  username = case
    when lower(coalesce(username, '')) in ('', 'user', 'użytkownik', 'uzytkownik')
    then coalesce(nullif(public_slug, ''), nullif(split_part(email, '@', 1), ''), username)
    else username
  end,
  public_slug = coalesce(nullif(public_slug, ''), nullif(username, ''), nullif(split_part(email, '@', 1), '')),
  updated_at = now()
where lower(coalesce(username, '')) in ('', 'user', 'użytkownik', 'uzytkownik')
   or coalesce(public_slug, '') = '';

create or replace function public.lock_profile_identity_v982()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  auth_email text;
  auth_username text;
  auth_name text;
  auth_avatar text;
begin
  select
    u.email,
    u.raw_user_meta_data->>'username',
    u.raw_user_meta_data->>'name',
    coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
  into auth_email, auth_username, auth_name, auth_avatar
  from auth.users u
  where u.id = new.id
  limit 1;

  new.email = coalesce(nullif(new.email, ''), auth_email);

  if lower(coalesce(new.username, '')) in ('', 'user', 'użytkownik', 'uzytkownik') then
    new.username = coalesce(
      nullif(new.public_slug, ''),
      nullif(auth_username, ''),
      nullif(auth_name, ''),
      nullif(split_part(coalesce(new.email, auth_email), '@', 1), ''),
      new.username
    );
  end if;

  if coalesce(new.public_slug, '') = '' then
    new.public_slug = coalesce(
      nullif(new.username, ''),
      nullif(auth_username, ''),
      nullif(auth_name, ''),
      nullif(split_part(coalesce(new.email, auth_email), '@', 1), '')
    );
  end if;

  new.avatar_url = coalesce(nullif(new.avatar_url, ''), auth_avatar);
  new.updated_at = now();

  return new;
end;
$func$;

drop trigger if exists trg_lock_profile_identity_v981 on public.profiles;
drop trigger if exists trg_lock_profile_identity_v982 on public.profiles;

create trigger trg_lock_profile_identity_v982
before insert or update of username, public_slug, email, avatar_url on public.profiles
for each row
execute function public.lock_profile_identity_v982();

-- Odśwież publiczny widok/funkcję profili, żeby frontend zawsze dostał właściwe nazwy.
create or replace view public.betai_public_profiles_for_ui_view as
select
  p.id,
  p.email,
  p.username,
  p.public_slug,
  p.avatar_url,
  p.bio,
  p.description,
  p.about,
  p.created_at,
  p.updated_at,
  p.followers_count,
  p.following_count,
  p.plan,
  p.subscription_status,
  p.is_admin,
  p.is_premium,
  p.imported_yield,
  p.imported_total_tips,
  p.imported_won_tips,
  p.imported_lost_tips,
  p.imported_pending_tips,
  p.imported_total_staked,
  p.imported_profit,
  p.imported_avg_odds,
  p.imported_highest_odds,
  p.imported_tips_amount,
  p.imported_tips_currency,
  p.stats_imported_at
from public.profiles p;

grant select on public.betai_public_profiles_for_ui_view to anon, authenticated;

drop function if exists public.betai_public_profiles_for_ui();

create function public.betai_public_profiles_for_ui()
returns table (
  id uuid,
  email text,
  username text,
  public_slug text,
  avatar_url text,
  bio text,
  description text,
  about text,
  created_at timestamptz,
  updated_at timestamptz,
  followers_count integer,
  following_count integer,
  plan text,
  subscription_status text,
  is_admin boolean,
  is_premium boolean,
  imported_yield numeric,
  imported_total_tips integer,
  imported_won_tips integer,
  imported_lost_tips integer,
  imported_pending_tips integer,
  imported_total_staked numeric,
  imported_profit numeric,
  imported_avg_odds numeric,
  imported_highest_odds numeric,
  imported_tips_amount numeric,
  imported_tips_currency text,
  stats_imported_at timestamptz
)
language sql
security definer
set search_path = public
as $func$
  select
    p.id,
    p.email,
    p.username,
    p.public_slug,
    p.avatar_url,
    p.bio,
    p.description,
    p.about,
    p.created_at,
    p.updated_at,
    p.followers_count,
    p.following_count,
    p.plan,
    p.subscription_status,
    p.is_admin,
    p.is_premium,
    p.imported_yield,
    p.imported_total_tips,
    p.imported_won_tips,
    p.imported_lost_tips,
    p.imported_pending_tips,
    p.imported_total_staked,
    p.imported_profit,
    p.imported_avg_odds,
    p.imported_highest_odds,
    p.imported_tips_amount,
    p.imported_tips_currency,
    p.stats_imported_at
  from public.profiles p;
$func$;

grant execute on function public.betai_public_profiles_for_ui() to anon, authenticated;

commit;
