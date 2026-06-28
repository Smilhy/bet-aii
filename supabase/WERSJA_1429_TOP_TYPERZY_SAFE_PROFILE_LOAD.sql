-- WERSJA 1429 — TOP TYPERZY SAFE PROFILE LOAD / STOP 400
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - usunąć czerwone 400 przy zakładce Top typerzy / profilu typera,
-- - zabezpieczyć starsze paczki, które selektowały public_slug/bio/imported_* albo filtrowały tips.author_id.
--
-- Nie usuwa danych.

create extension if not exists pgcrypto;

-- Bezpieczne kolumny profilu używane przez UI. ADD COLUMN IF NOT EXISTS nic nie zmienia, jeśli kolumna już jest.
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists description text;
alter table public.profiles add column if not exists about text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists followers_count integer not null default 0;
alter table public.profiles add column if not exists following_count integer not null default 0;
alter table public.profiles add column if not exists imported_yield numeric not null default 0;
alter table public.profiles add column if not exists imported_total_tips integer not null default 0;
alter table public.profiles add column if not exists imported_won_tips integer not null default 0;
alter table public.profiles add column if not exists imported_lost_tips integer not null default 0;
alter table public.profiles add column if not exists imported_pending_tips integer not null default 0;
alter table public.profiles add column if not exists imported_total_staked numeric not null default 0;
alter table public.profiles add column if not exists imported_profit numeric not null default 0;
alter table public.profiles add column if not exists imported_avg_odds numeric not null default 0;
alter table public.profiles add column if not exists imported_highest_odds numeric not null default 0;
alter table public.profiles add column if not exists imported_tips_amount numeric not null default 0;
alter table public.profiles add column if not exists imported_tips_currency text;
alter table public.profiles add column if not exists stats_imported_at timestamptz;

-- Bezpieczne kolumny tips używane przez stare filtry UI.
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists tipster_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists user_email text;
alter table public.tips add column if not exists email text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists username text;
alter table public.tips add column if not exists public_slug text;
alter table public.tips add column if not exists author_avatar_url text;
alter table public.tips add column if not exists avatar_url text;

-- Uzupełnienia, jeśli masz user_id ale author_id było puste albo odwrotnie.
update public.tips
set author_id = coalesce(author_id, user_id, tipster_id),
    user_id = coalesce(user_id, author_id, tipster_id),
    tipster_id = coalesce(tipster_id, author_id, user_id)
where author_id is null or user_id is null or tipster_id is null;

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

create index if not exists profiles_public_slug_idx
  on public.profiles (public_slug);

create index if not exists profiles_username_idx
  on public.profiles (username);

create index if not exists tips_created_at_idx
  on public.tips (created_at desc);

create index if not exists tips_author_created_idx
  on public.tips (author_id, created_at desc);

create index if not exists tips_user_created_idx
  on public.tips (user_id, created_at desc);

create index if not exists tips_tipster_created_idx
  on public.tips (tipster_id, created_at desc);

notify pgrst, 'reload schema';

select 'WERSJA 1429 top tipsters safe profile load ready' as status;
