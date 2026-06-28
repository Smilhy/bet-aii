-- WERSJA 1652 — AKO: osobne zdarzenia kuponu zamiast zapisywania ich w analizie.
-- Uruchom RAZ w Supabase SQL Editor.

alter table public.tips add column if not exists coupon_type text default 'single';
alter table public.tips add column if not exists is_ako boolean default false;
alter table public.tips add column if not exists legs_count integer default 1;
alter table public.tips add column if not exists legs_json jsonb;

create index if not exists tips_coupon_type_idx on public.tips(coupon_type);
create index if not exists tips_is_ako_idx on public.tips(is_ako);

-- Opcjonalne czyszczenie starych analiz z wersji 1651:
-- zostawia normalną analizę użytkownika, a usuwa dopisany blok "Kupon AKO:".
update public.tips
set
  analysis = nullif(trim(regexp_replace(coalesce(analysis, ''), E'\\n{0,2}\\s*Kupon\\s+AKO:\\s*[\\s\\S]*$', '', 'i')), ''),
  description = nullif(trim(regexp_replace(coalesce(description, ''), E'\\n{0,2}\\s*Kupon\\s+AKO:\\s*[\\s\\S]*$', '', 'i')), '')
where coalesce(analysis, description, '') ~* 'Kupon\s+AKO:';

select 'WERSJA 1652 AKO OSOBNE ZDARZENIA OK' as status;
