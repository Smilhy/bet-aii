-- WERSJA 985 — OPINIE PROFILU / OCENY TYPERÓW
-- Uruchom w Supabase SQL Editor.
-- Nie rusza CORE LOCK v983: nie zmienia statystyk typów, nazw, rankingu ani realtime typów.
--
-- Dodaje:
-- - tabelę public.profile_reviews,
-- - jedną opinię jednego użytkownika dla jednego profilu,
-- - automatyczne przeliczanie rating_avg / rating_count / rating_distribution w profiles,
-- - realtime dla opinii.

begin;

alter table public.profiles add column if not exists rating_avg numeric default 0;
alter table public.profiles add column if not exists rating_count integer default 0;
alter table public.profiles add column if not exists reviews_count integer default 0;
alter table public.profiles add column if not exists rating_distribution jsonb default '{}'::jsonb;

create table if not exists public.profile_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_name text,
  reviewer_email text,
  rating integer not null default 5 check (rating >= 1 and rating <= 5),
  comment text not null default '',
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_reviews_profile_reviewer_uidx
on public.profile_reviews(profile_id, reviewer_id)
where reviewer_id is not null;

create index if not exists profile_reviews_profile_id_idx
on public.profile_reviews(profile_id);

create index if not exists profile_reviews_created_at_idx
on public.profile_reviews(created_at desc);

alter table public.profile_reviews enable row level security;

drop policy if exists profile_reviews_select_approved on public.profile_reviews;
create policy profile_reviews_select_approved
on public.profile_reviews
for select
to anon, authenticated
using (is_approved = true);

drop policy if exists profile_reviews_insert_authenticated on public.profile_reviews;
create policy profile_reviews_insert_authenticated
on public.profile_reviews
for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and profile_id is not null
  and rating between 1 and 5
);

drop policy if exists profile_reviews_update_own on public.profile_reviews;
create policy profile_reviews_update_own
on public.profile_reviews
for update
to authenticated
using (reviewer_id = auth.uid())
with check (
  reviewer_id = auth.uid()
  and rating between 1 and 5
);

drop policy if exists profile_reviews_delete_own on public.profile_reviews;
create policy profile_reviews_delete_own
on public.profile_reviews
for delete
to authenticated
using (reviewer_id = auth.uid());

create or replace function public.recalculate_profile_reviews_stats(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  dist jsonb;
begin
  select jsonb_build_object(
    '5', count(*) filter (where rating = 5),
    '4', count(*) filter (where rating = 4),
    '3', count(*) filter (where rating = 3),
    '2', count(*) filter (where rating = 2),
    '1', count(*) filter (where rating = 1)
  )
  into dist
  from public.profile_reviews
  where profile_id = p_profile_id
    and is_approved = true;

  update public.profiles p
  set
    rating_avg = coalesce((
      select round(avg(rating)::numeric, 2)
      from public.profile_reviews
      where profile_id = p_profile_id
        and is_approved = true
    ), 0),
    rating_count = coalesce((
      select count(*)::int
      from public.profile_reviews
      where profile_id = p_profile_id
        and is_approved = true
    ), 0),
    reviews_count = coalesce((
      select count(*)::int
      from public.profile_reviews
      where profile_id = p_profile_id
        and is_approved = true
    ), 0),
    rating_distribution = coalesce(dist, '{}'::jsonb),
    updated_at = now()
  where p.id = p_profile_id;
end;
$func$;

create or replace function public.handle_profile_reviews_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  affected_profile uuid;
begin
  if tg_op = 'DELETE' then
    affected_profile := old.profile_id;
  else
    affected_profile := new.profile_id;
  end if;

  if affected_profile is not null then
    perform public.recalculate_profile_reviews_stats(affected_profile);
  end if;

  if tg_op = 'UPDATE' and old.profile_id is distinct from new.profile_id and old.profile_id is not null then
    perform public.recalculate_profile_reviews_stats(old.profile_id);
  end if;

  return coalesce(new, old);
end;
$func$;

drop trigger if exists trg_profile_reviews_stats on public.profile_reviews;
create trigger trg_profile_reviews_stats
after insert or update or delete on public.profile_reviews
for each row
execute function public.handle_profile_reviews_stats();

-- Przelicz istniejące profile.
do $func$
declare
  r record;
begin
  for r in select id from public.profiles
  loop
    perform public.recalculate_profile_reviews_stats(r.id);
  end loop;
end;
$func$;

-- Realtime dla opinii.
alter table public.profile_reviews replica identity full;
alter table public.profiles replica identity full;

do $func$
begin
  begin
    alter publication supabase_realtime add table public.profile_reviews;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;

  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;
end;
$func$;

commit;
