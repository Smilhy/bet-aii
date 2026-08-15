-- WERSJA 1655 — AKO auto-rozliczanie i ukrywanie z feedu po starcie pierwszego zdarzenia.
-- Uruchom w Supabase SQL Editor raz. Bezpieczne: dodaje tylko brakujące kolumny.

alter table public.tips add column if not exists coupon_type text default 'single';
alter table public.tips add column if not exists is_ako boolean default false;
alter table public.tips add column if not exists legs_count integer default 1;
alter table public.tips add column if not exists legs_json jsonb;

create index if not exists tips_coupon_type_idx on public.tips(coupon_type);
create index if not exists tips_is_ako_idx on public.tips(is_ako);
create index if not exists tips_settlement_status_idx on public.tips(settlement_status);

update public.tips
set legs_count = greatest(coalesce(legs_count, 0), jsonb_array_length(legs_json))
where (is_ako = true or lower(coalesce(coupon_type, '')) = 'ako')
  and jsonb_typeof(legs_json) = 'array';

select 'WERSJA 1655 AKO AUTO SETTLEMENT SQL OK' as status;
