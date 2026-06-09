-- WERSJA 1432 — TOP TYPERZY HARD STOP 400 / PROFILES + TIPS SAFE SCHEMA
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - usunąć czerwone 400 w zakładce Top typerzy,
-- - frontend 1432 nie pyta już o konkretne ryzykowne kolumny profiles/tips,
-- - SQL dopina brakujące kolumny używane przez starsze paczki i avatar/profil typera,
-- - odświeża cache PostgREST.
--
-- Nie usuwa danych.

create extension if not exists pgcrypto;

-- profiles: bezpieczne kolumny profilu / top typerzy / avatary
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists description text;
alter table public.profiles add column if not exists about text;
alter table public.profiles add column if not exists following_count integer not null default 0;
alter table public.profiles add column if not exists followers_count integer not null default 0;
alter table public.profiles add column if not exists rating_avg numeric not null default 0;
alter table public.profiles add column if not exists rating_count integer not null default 0;
alter table public.profiles add column if not exists reviews_count integer not null default 0;
alter table public.profiles add column if not exists imported_total_tips integer not null default 0;
alter table public.profiles add column if not exists imported_won_tips integer not null default 0;
alter table public.profiles add column if not exists imported_lost_tips integer not null default 0;
alter table public.profiles add column if not exists imported_pending_tips integer not null default 0;
alter table public.profiles add column if not exists imported_total_staked numeric not null default 0;
alter table public.profiles add column if not exists imported_profit numeric not null default 0;
alter table public.profiles add column if not exists imported_yield numeric not null default 0;
alter table public.profiles add column if not exists imported_avg_odds numeric not null default 0;
alter table public.profiles add column if not exists imported_highest_odds numeric not null default 0;
alter table public.profiles add column if not exists imported_tips_amount numeric not null default 0;
alter table public.profiles add column if not exists imported_tips_currency text;
alter table public.profiles add column if not exists stats_imported_at timestamptz;

-- tips: bezpieczne kolumny profilu / top typerzy / avatary
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists tipster_id uuid;
alter table public.tips add column if not exists profile_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists user_email text;
alter table public.tips add column if not exists email text;
alter table public.tips add column if not exists username text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists user_name text;
alter table public.tips add column if not exists tipster_name text;
alter table public.tips add column if not exists public_slug text;
alter table public.tips add column if not exists author_avatar_url text;
alter table public.tips add column if not exists avatar_url text;
alter table public.tips add column if not exists profile_avatar_url text;
alter table public.tips add column if not exists photo_url text;
alter table public.tips add column if not exists picture text;
alter table public.tips add column if not exists image_url text;
alter table public.tips add column if not exists updated_at timestamptz;

create index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_public_slug_lower_idx on public.profiles (lower(public_slug));
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create index if not exists tips_created_at_idx on public.tips (created_at desc);
create index if not exists tips_author_created_idx on public.tips (author_id, created_at desc);
create index if not exists tips_user_created_idx on public.tips (user_id, created_at desc);
create index if not exists tips_tipster_created_idx on public.tips (tipster_id, created_at desc);
create index if not exists tips_author_email_lower_idx on public.tips (lower(author_email));
create index if not exists tips_user_email_lower_idx on public.tips (lower(user_email));
create index if not exists tips_username_lower_idx on public.tips (lower(username));
create index if not exists tips_public_slug_lower_idx on public.tips (lower(public_slug));

notify pgrst, 'reload schema';

select 'WERSJA 1432 top typerzy hard stop 400 ready' as status;
