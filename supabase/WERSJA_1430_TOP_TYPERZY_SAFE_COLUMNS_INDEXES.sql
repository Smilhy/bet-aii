-- WERSJA 1430 — TOP TYPERZY STOP 400 / SAFE COLUMNS + INDEXES
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - usunąć czerwone 400 w zakładce Top typerzy,
-- - dołożyć brakujące kolumny, które frontend/stare paczki mogły pytać,
-- - dodać indeksy pod szybkie filtrowanie.
--
-- Nie usuwa danych.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists followers_count integer not null default 0;
alter table public.profiles add column if not exists imported_total_tips integer not null default 0;
alter table public.profiles add column if not exists imported_won_tips integer not null default 0;
alter table public.profiles add column if not exists imported_lost_tips integer not null default 0;
alter table public.profiles add column if not exists imported_yield numeric not null default 0;
alter table public.profiles add column if not exists imported_profit numeric not null default 0;

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
alter table public.tips add column if not exists avatar_url text;

create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create index if not exists profiles_public_slug_lower_idx
  on public.profiles (lower(public_slug));

create index if not exists tips_created_at_idx
  on public.tips (created_at desc);

create index if not exists tips_author_created_idx
  on public.tips (author_id, created_at desc);

create index if not exists tips_user_created_idx
  on public.tips (user_id, created_at desc);

create index if not exists tips_tipster_created_idx
  on public.tips (tipster_id, created_at desc);

create index if not exists tips_author_email_lower_idx
  on public.tips (lower(author_email));

create index if not exists tips_user_email_lower_idx
  on public.tips (lower(user_email));

create index if not exists tips_username_lower_idx
  on public.tips (lower(username));

notify pgrst, 'reload schema';

select 'WERSJA 1430 top typerzy safe columns/indexes ready' as status;
