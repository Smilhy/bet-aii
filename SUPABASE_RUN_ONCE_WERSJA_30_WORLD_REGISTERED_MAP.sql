-- WERSJA 30 — Mapa świata zarejestrowanych użytkowników
-- Uruchom raz w Supabase SQL Editor, żeby nowe rejestracje mogły zapisywać kraj do profilu.

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

comment on column public.profiles.registered_country_code is 'WERSJA 30: kraj wykryty przy rejestracji/logowaniu dla mapy świata.';
comment on column public.profiles.registered_country_name is 'WERSJA 30: nazwa kraju wykryta dla mapy świata.';
