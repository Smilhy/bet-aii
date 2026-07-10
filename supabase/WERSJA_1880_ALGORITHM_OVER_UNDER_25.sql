-- WERSJA 1880 — zakładka ALGORYTM, wzór presji Over/Under 2.5
-- Uruchom ten plik jeden raz w Supabase SQL Editor przed wdrożeniem Netlify.

create extension if not exists pgcrypto;

create table if not exists public.algorithm_team_form_cache (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null,
  team_name text not null default '',
  as_of_date date not null,
  sample_size integer not null default 5 check (sample_size between 3 and 10),
  matches_count integer not null default 0,
  shots_for numeric(10,3) not null default 0,
  corners_for numeric(10,3) not null default 0,
  shots_allowed numeric(10,3) not null default 0,
  corners_allowed numeric(10,3) not null default 0,
  source_fixture_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, as_of_date, sample_size)
);

create table if not exists public.algorithm_bets (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null unique,
  sport text not null default 'football',
  league_id bigint,
  league_name text not null default '',
  country text not null default '',
  home_team_id bigint,
  away_team_id bigint,
  home_team text not null,
  away_team text not null,
  home_logo text not null default '',
  away_logo text not null default '',
  kickoff timestamptz not null,

  sample_size integer not null default 5,
  home_matches_count integer not null default 0,
  away_matches_count integer not null default 0,
  home_shots_for numeric(10,3) not null default 0,
  home_corners_for numeric(10,3) not null default 0,
  home_shots_allowed numeric(10,3) not null default 0,
  home_corners_allowed numeric(10,3) not null default 0,
  away_shots_for numeric(10,3) not null default 0,
  away_corners_for numeric(10,3) not null default 0,
  away_shots_allowed numeric(10,3) not null default 0,
  away_corners_allowed numeric(10,3) not null default 0,

  home_attack_pressure numeric(10,3) not null default 0,
  home_defence_pressure numeric(10,3) not null default 0,
  away_attack_pressure numeric(10,3) not null default 0,
  away_defence_pressure numeric(10,3) not null default 0,
  expected_home_pressure numeric(10,3) not null default 0,
  expected_away_pressure numeric(10,3) not null default 0,
  total_pressure numeric(10,3) not null default 0,

  over_probability numeric(7,3) not null default 0,
  under_probability numeric(7,3) not null default 0,
  fair_over_odds numeric(8,3) not null default 0,
  fair_under_odds numeric(8,3) not null default 0,
  over_odds numeric(8,3),
  under_odds numeric(8,3),
  over_bookmaker text not null default '',
  under_bookmaker text not null default '',
  over_market_books integer not null default 0,
  under_market_books integer not null default 0,
  over_ev_pct numeric(9,3),
  under_ev_pct numeric(9,3),

  selected_market text not null default 'no_bet' check (selected_market in ('over_2_5', 'under_2_5', 'no_bet')),
  selected_label text not null default 'Brak zakładu',
  selected_probability numeric(7,3) not null default 0,
  selected_odds numeric(8,3) not null default 0,
  edge_pct numeric(9,3),
  stake numeric(10,2) not null default 0,

  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void', 'no_bet')),
  result text,
  home_goals integer,
  away_goals integer,
  total_goals integer,
  profit numeric(10,2) not null default 0,
  settlement_source text,
  settled_at timestamptz,

  model_version text not null default 'pressure-ou25-v1',
  formula_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists algorithm_bets_kickoff_idx on public.algorithm_bets(kickoff desc);
create index if not exists algorithm_bets_status_idx on public.algorithm_bets(status, kickoff desc);
create index if not exists algorithm_bets_selected_market_idx on public.algorithm_bets(selected_market, kickoff desc);
create index if not exists algorithm_team_form_cache_lookup_idx on public.algorithm_team_form_cache(team_id, as_of_date desc, sample_size);

alter table public.algorithm_bets enable row level security;
alter table public.algorithm_team_form_cache enable row level security;

drop policy if exists "algorithm bets public read" on public.algorithm_bets;
create policy "algorithm bets public read"
on public.algorithm_bets
for select
to anon, authenticated
using (true);

-- Cache formy jest techniczny. Frontend go nie czyta; zapis/odczyt wykonuje Service Role.
-- Brak polityk INSERT/UPDATE oznacza, że zwykły użytkownik nie może zmieniać danych.

grant select on public.algorithm_bets to anon, authenticated;

create or replace function public.algorithm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists algorithm_bets_set_updated_at on public.algorithm_bets;
create trigger algorithm_bets_set_updated_at
before update on public.algorithm_bets
for each row execute function public.algorithm_set_updated_at();

drop trigger if exists algorithm_team_form_cache_set_updated_at on public.algorithm_team_form_cache;
create trigger algorithm_team_form_cache_set_updated_at
before update on public.algorithm_team_form_cache
for each row execute function public.algorithm_set_updated_at();

comment on table public.algorithm_bets is 'Automatyczne testy modelu presji Over/Under 2.5, płaska stawka 1 jednostka.';
comment on column public.algorithm_bets.total_pressure is 'Suma oczekiwanej presji obu zespołów.';
comment on column public.algorithm_bets.edge_pct is 'EV wybranego rynku: prawdopodobieństwo * kurs - 1, w procentach.';
