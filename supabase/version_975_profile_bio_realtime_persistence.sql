-- WERSJA 975 — globalne zapisywanie i odświeżanie opisów profili
-- Uruchom w Supabase SQL Editor.
-- Cel: każdy opis profilu zapisuje się w profiles.bio/description/about i jest widoczny publicznie oraz realtime.

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists description text;
alter table public.profiles add column if not exists about text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Uzupełnij puste pola opisów, żeby aplikacja zawsze miała jedno źródło prawdy.
update public.profiles
set
  bio = nullif(coalesce(bio, description, about, ''), ''),
  description = nullif(coalesce(description, bio, about, ''), ''),
  about = nullif(coalesce(about, bio, description, ''), ''),
  updated_at = coalesce(updated_at, now());

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at = now();

  -- Trzy pola trzymamy spójnie. Jeśli zmienisz bio, opis i about też dostają tę treść.
  if new.bio is distinct from old.bio then
    new.description = new.bio;
    new.about = new.bio;
  elsif new.description is distinct from old.description then
    new.bio = new.description;
    new.about = new.description;
  elsif new.about is distinct from old.about then
    new.bio = new.about;
    new.description = new.about;
  end if;

  return new;
end;
$func$;

drop trigger if exists trg_profiles_updated_at_bio_sync on public.profiles;
create trigger trg_profiles_updated_at_bio_sync
before update of bio, description, about, avatar_url, username, public_slug on public.profiles
for each row
execute function public.set_profile_updated_at();

-- Publiczny widok profili dla UI: avatar + opis + podstawowe statystyki.
create or replace view public.betai_public_profiles_for_ui_view as
select
  id,
  email,
  username,
  public_slug,
  avatar_url,
  bio,
  description,
  about,
  created_at,
  updated_at,
  followers_count,
  following_count,
  plan,
  subscription_status,
  is_admin,
  is_premium,
  imported_yield,
  imported_total_tips,
  imported_won_tips,
  imported_lost_tips,
  imported_pending_tips,
  imported_total_staked,
  imported_profit,
  imported_avg_odds,
  imported_highest_odds,
  imported_tips_amount,
  imported_tips_currency,
  stats_imported_at
from public.profiles;

grant select on public.betai_public_profiles_for_ui_view to anon, authenticated;

-- Funkcja RPC używana przez frontend. Najpierw usuwamy starą, bo Postgres nie pozwala zmienić return type w CREATE OR REPLACE.
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

-- Realtime dla profili. Jeśli tabela już jest w publikacji, błąd jest ignorowany.
do $func$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;
end;
$func$;

-- Przy realtime UPDATE dobrze mieć pełny rekord.
alter table public.profiles replica identity full;
