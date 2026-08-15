-- WERSJA 32 — ręczne uzupełnienie flag obecnych użytkowników + kolumny pod automat.
-- Uruchom raz w Supabase SQL Editor.
-- UK: buchajson1988, p.kucharski, smilhytv.
-- Reszta obecnych kont bez kraju: Polska.

alter table public.profiles
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists registered_country_code text,
  add column if not exists registered_country_name text,
  add column if not exists locale text,
  add column if not exists timezone text,
  add column if not exists registration_country_source text;

create index if not exists profiles_registered_country_code_idx
  on public.profiles (registered_country_code);

create index if not exists profiles_country_code_idx
  on public.profiles (country_code);

-- 1) Ręcznie wskazani użytkownicy z UK.
update public.profiles
set
  country_code = 'GB',
  country_name = 'Wielka Brytania',
  registered_country_code = 'GB',
  registered_country_name = 'Wielka Brytania',
  registration_country_source = 'manual_v32_uk',
  updated_at = now()
where lower(coalesce(username, '')) in ('buchajson1988', 'p.kucharski', 'smilhytv')
   or lower(split_part(coalesce(email, ''), '@', 1)) in ('buchajson1988', 'p.kucharski', 'smilhytv');

-- 2) Wszystkie pozostałe obecne profile bez kraju ustawiamy na Polskę.
-- Nie nadpisuje profili, które mają już poprawny kraj inny niż pusty/ZZ/Nieznany.
update public.profiles
set
  country_code = 'PL',
  country_name = 'Polska',
  registered_country_code = 'PL',
  registered_country_name = 'Polska',
  registration_country_source = 'manual_v32_pl_backfill',
  updated_at = now()
where not (
    lower(coalesce(username, '')) in ('buchajson1988', 'p.kucharski', 'smilhytv')
    or lower(split_part(coalesce(email, ''), '@', 1)) in ('buchajson1988', 'p.kucharski', 'smilhytv')
  )
  and (
    country_code is null
    or btrim(country_code) = ''
    or upper(country_code) = 'ZZ'
    or country_name is null
    or btrim(country_name) = ''
    or lower(country_name) in ('nieznany kraj', 'unknown', 'unknown country')
  );

-- 3) Kontrola po migracji.
select
  coalesce(registered_country_code, country_code, 'ZZ') as country_code,
  coalesce(registered_country_name, country_name, 'Nieznany kraj') as country_name,
  count(*) as users_count
from public.profiles
group by 1, 2
order by users_count desc, country_name asc;
