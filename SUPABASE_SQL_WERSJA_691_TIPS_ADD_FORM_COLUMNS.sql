-- BET+AI WERSJA 691
-- FIX: Dodaj typ — brakujące kolumny w tabeli public.tips.
-- Błąd z ekranu: Could not find the 'author_id' column of 'tips' in the schema cache.
-- Wklej w Supabase SQL Editor i kliknij RUN.
-- Wybierz: Run without RLS.

create extension if not exists pgcrypto;

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.tips
  add column if not exists author_id uuid,
  add column if not exists user_id uuid,
  add column if not exists author_name text,
  add column if not exists author_email text,
  add column if not exists username text,
  add column if not exists sport text,
  add column if not exists league text,
  add column if not exists match text,
  add column if not exists team_home text,
  add column if not exists team_away text,
  add column if not exists match_time timestamptz,
  add column if not exists market text,
  add column if not exists bet_type text,
  add column if not exists prediction text,
  add column if not exists odds numeric,
  add column if not exists course numeric,
  add column if not exists stake numeric,
  add column if not exists description text,
  add column if not exists analysis text,
  add column if not exists ai_analysis text,
  add column if not exists ai_source text,
  add column if not exists ai_confidence numeric,
  add column if not exists ai_probability numeric,
  add column if not exists confidence numeric,
  add column if not exists access_type text default 'free',
  add column if not exists access text default 'free',
  add column if not exists is_premium boolean not null default false,
  add column if not exists price numeric not null default 0,
  add column if not exists single_price numeric not null default 0,
  add column if not exists tip_price numeric not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists likes integer not null default 0,
  add column if not exists dislikes integer not null default 0;

-- Uzupełnienia dla starszych wpisów.
update public.tips
set
  author_id = coalesce(author_id, user_id),
  user_id = coalesce(user_id, author_id),
  username = coalesce(nullif(username, ''), nullif(author_name, ''), split_part(coalesce(author_email, ''), '@', 1)),
  author_name = coalesce(nullif(author_name, ''), nullif(username, ''), split_part(coalesce(author_email, ''), '@', 1), 'Użytkownik'),
  access_type = coalesce(nullif(access_type, ''), nullif(access, ''), case when is_premium then 'premium' else 'free' end, 'free'),
  access = coalesce(nullif(access, ''), nullif(access_type, ''), case when is_premium then 'premium' else 'free' end, 'free'),
  is_premium = coalesce(is_premium, false) or coalesce(price, 0) > 0,
  price = coalesce(price, single_price, tip_price, 0),
  single_price = coalesce(single_price, price, tip_price, 0),
  tip_price = coalesce(tip_price, price, single_price, 0)
where true;

create index if not exists idx_tips_author_created on public.tips (author_id, created_at desc);
create index if not exists idx_tips_user_created on public.tips (user_id, created_at desc);
create index if not exists idx_tips_created on public.tips (created_at desc);
create index if not exists idx_tips_access_type on public.tips (access_type);
create index if not exists idx_tips_is_premium on public.tips (is_premium);

-- RLS/policies: pozwól zalogowanym czytać typy i dodawać własne.
alter table public.tips enable row level security;

drop policy if exists "tips select all v691" on public.tips;
create policy "tips select all v691"
on public.tips
for select
to authenticated
using (true);

drop policy if exists "tips insert own v691" on public.tips;
create policy "tips insert own v691"
on public.tips
for insert
to authenticated
with check (
  auth.uid() = coalesce(author_id, user_id)
);

drop policy if exists "tips update own v691" on public.tips;
create policy "tips update own v691"
on public.tips
for update
to authenticated
using (
  auth.uid() = coalesce(author_id, user_id)
)
with check (
  auth.uid() = coalesce(author_id, user_id)
);

-- Realtime:
-- Po SQL wejdź Supabase -> Database -> Publications -> supabase_realtime
-- i upewnij się, że tabela tips jest zielona.
