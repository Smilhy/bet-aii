
-- SUPABASE_SITE_REVIEWS_512.sql
-- Live opinie / gwiazdki Bet+AI.
-- Każdy użytkownik albo gość może dodać ocenę 1-5 i komentarz.
-- Opinie zapisują się na stałe w Supabase i wyświetlają live.

create extension if not exists "pgcrypto";

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  guest_session_id text,
  user_email text,
  user_name text,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 3 and 500),
  is_approved boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.site_reviews add column if not exists user_id uuid;
alter table public.site_reviews add column if not exists guest_session_id text;
alter table public.site_reviews add column if not exists user_email text;
alter table public.site_reviews add column if not exists user_name text;
alter table public.site_reviews add column if not exists rating integer;
alter table public.site_reviews add column if not exists comment text;
alter table public.site_reviews add column if not exists is_approved boolean default true;
alter table public.site_reviews add column if not exists created_at timestamptz default now();
alter table public.site_reviews add column if not exists updated_at timestamptz default now();

alter table public.site_reviews enable row level security;

drop policy if exists "site_reviews_public_select_approved" on public.site_reviews;
create policy "site_reviews_public_select_approved"
on public.site_reviews
for select
using (is_approved = true or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com');

drop policy if exists "site_reviews_public_insert" on public.site_reviews;
create policy "site_reviews_public_insert"
on public.site_reviews
for insert
with check (
  rating between 1 and 5
  and char_length(comment) between 3 and 500
  and (
    auth.uid() = user_id
    or user_id is null
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
  )
);

drop policy if exists "site_reviews_admin_update" on public.site_reviews;
create policy "site_reviews_admin_update"
on public.site_reviews
for update
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com');

create or replace function public.touch_site_reviews_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_site_reviews_updated_at on public.site_reviews;

create trigger touch_site_reviews_updated_at
before update on public.site_reviews
for each row
execute function public.touch_site_reviews_updated_at();

create index if not exists site_reviews_created_at_idx
on public.site_reviews(created_at desc);

create index if not exists site_reviews_approved_idx
on public.site_reviews(is_approved);

create index if not exists site_reviews_rating_idx
on public.site_reviews(rating);

grant usage on schema public to anon, authenticated;
grant select, insert on public.site_reviews to anon, authenticated;
grant update on public.site_reviews to authenticated;

-- Dla pełnego live:
-- Supabase → Database → Replication → supabase_realtime → Add table:
-- public.site_reviews
