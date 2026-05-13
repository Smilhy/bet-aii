-- WERSJA 966 — żywe statystyki typera zapisywane w bazie
-- Uruchom w Supabase SQL Editor.
-- Cel: każdy użytkownik ma swój snapshot statystyk, który aktualizuje się po dodaniu/rozliczeniu typu.

create table if not exists public.tipster_stats_snapshots (
  tipster_id uuid primary key references public.profiles(id) on delete cascade,
  total_tips integer not null default 0,
  won_tips integer not null default 0,
  lost_tips integer not null default 0,
  pending_tips integer not null default 0,
  settled_tips integer not null default 0,
  total_staked numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  yield_percent numeric(10,2) not null default 0,
  avg_odds numeric(10,2) not null default 0,
  highest_odds numeric(10,2) not null default 0,
  type_stats jsonb not null default '[]'::jsonb,
  sport_stats jsonb not null default '[]'::jsonb,
  odds_stats jsonb not null default '[]'::jsonb,
  hour_stats jsonb not null default '[]'::jsonb,
  month_stats jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists tipster_stats_snapshots_profit_idx
on public.tipster_stats_snapshots(profit desc);

create index if not exists tipster_stats_snapshots_yield_idx
on public.tipster_stats_snapshots(yield_percent desc);

alter table public.tipster_stats_snapshots enable row level security;

drop policy if exists "tipster_stats_snapshots_select_all" on public.tipster_stats_snapshots;
create policy "tipster_stats_snapshots_select_all"
on public.tipster_stats_snapshots
for select
using (true);

drop policy if exists "tipster_stats_snapshots_insert_own" on public.tipster_stats_snapshots;
create policy "tipster_stats_snapshots_insert_own"
on public.tipster_stats_snapshots
for insert
with check (auth.uid() = tipster_id);

drop policy if exists "tipster_stats_snapshots_update_own" on public.tipster_stats_snapshots;
create policy "tipster_stats_snapshots_update_own"
on public.tipster_stats_snapshots
for update
using (auth.uid() = tipster_id)
with check (auth.uid() = tipster_id);

-- Trigger aktualizacji updated_at.
create or replace function public.set_tipster_stats_snapshot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tipster_stats_snapshots_updated_at on public.tipster_stats_snapshots;
create trigger trg_tipster_stats_snapshots_updated_at
before update on public.tipster_stats_snapshots
for each row
execute function public.set_tipster_stats_snapshot_updated_at();
