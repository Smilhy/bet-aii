-- BetAI wersja 215 — poprawka dodawania typów przez zwykłych użytkowników
-- Cel: każdy zalogowany użytkownik może dodać typ, a feed/dashboard może go od razu odczytać.

alter table if exists public.tips enable row level security;

alter table if exists public.tips add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table if exists public.tips add column if not exists author_name text default 'Użytkownik';
alter table if exists public.tips add column if not exists ai_confidence int;
alter table if exists public.tips add column if not exists ai_score int;
alter table if exists public.tips add column if not exists ai_analysis text;
alter table if exists public.tips add column if not exists is_premium boolean default false;
alter table if exists public.tips add column if not exists notify_followers boolean default true;

-- Czytanie feedu dla wszystkich zalogowanych i gości.
drop policy if exists "BetAI read tips feed" on public.tips;
create policy "BetAI read tips feed"
on public.tips for select
to anon, authenticated
using (true);

-- Dodawanie typów przez zalogowanego usera tylko jako on sam.
drop policy if exists "BetAI users insert own tips" on public.tips;
create policy "BetAI users insert own tips"
on public.tips for insert
to authenticated
with check (author_id = auth.uid());

-- Edycja tylko własnych typów; admin/server dalej działa przez service role.
drop policy if exists "BetAI users update own tips" on public.tips;
create policy "BetAI users update own tips"
on public.tips for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_author_id on public.tips(author_id);
