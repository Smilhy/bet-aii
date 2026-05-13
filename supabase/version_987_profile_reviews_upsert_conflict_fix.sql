-- WERSJA 987 — FIX OPINIE: ON CONFLICT profile_id,reviewer_id
-- Uruchom w Supabase SQL Editor.
--
-- Naprawia błąd:
-- there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- Przyczyna:
-- wcześniejszy indeks był częściowy:
--   where reviewer_id is not null
-- a Supabase upsert używa:
--   onConflict: 'profile_id,reviewer_id'
--
-- Rozwiązanie:
-- robimy pełny unikalny indeks na (profile_id, reviewer_id).
-- Dla reviewer_id = null PostgreSQL i tak pozwoli na wiele rekordów gości,
-- ale dla zalogowanych użytkowników wymusi jedną opinię na jeden profil.

begin;

-- Upewnij się, że tabela istnieje.
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

-- Usuń stary częściowy indeks, który nie pasuje do ON CONFLICT.
drop index if exists public.profile_reviews_profile_reviewer_uidx;

-- Usuń ewentualne duplikaty zalogowanych opinii, zanim założymy pełny unikalny indeks.
-- Zostawiamy najnowszą opinię danego użytkownika dla danego profilu.
delete from public.profile_reviews r
using public.profile_reviews newer
where r.profile_id = newer.profile_id
  and r.reviewer_id = newer.reviewer_id
  and r.reviewer_id is not null
  and newer.reviewer_id is not null
  and r.created_at < newer.created_at;

-- Pełny indeks zgodny z Supabase upsert onConflict: profile_id,reviewer_id.
create unique index if not exists profile_reviews_profile_reviewer_uidx
on public.profile_reviews(profile_id, reviewer_id);

-- Dla bezpieczeństwa odśwież trigger statystyk opinii, jeśli funkcja istnieje.
do $func$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_profile_reviews_stats'
  ) then
    drop trigger if exists trg_profile_reviews_stats on public.profile_reviews;

    create trigger trg_profile_reviews_stats
    after insert or update or delete on public.profile_reviews
    for each row
    execute function public.handle_profile_reviews_stats();
  end if;
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
