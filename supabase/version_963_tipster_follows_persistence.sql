-- WERSJA 963 — trwałe obserwowanie typerów
-- Uruchom w Supabase SQL Editor.
-- Cel: Obserwuj/Obserwujesz ma zapisywać się po odświeżeniu strony i działać globalnie.

create table if not exists public.tipster_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  tipster_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, tipster_id),
  check (follower_id <> tipster_id)
);

create index if not exists tipster_follows_follower_id_idx on public.tipster_follows(follower_id);
create index if not exists tipster_follows_tipster_id_idx on public.tipster_follows(tipster_id);

alter table public.tipster_follows enable row level security;

drop policy if exists "tipster_follows_select_all" on public.tipster_follows;
create policy "tipster_follows_select_all"
on public.tipster_follows
for select
using (true);

drop policy if exists "tipster_follows_insert_own" on public.tipster_follows;
create policy "tipster_follows_insert_own"
on public.tipster_follows
for insert
with check (auth.uid() = follower_id);

drop policy if exists "tipster_follows_delete_own" on public.tipster_follows;
create policy "tipster_follows_delete_own"
on public.tipster_follows
for delete
using (auth.uid() = follower_id);
