-- WERSJA 1886 — automat PRE-MATCH, kontrola limitu API i pojedynczy worker.
-- Uruchom po migracjach V1880, V1882 i V1885.

create extension if not exists pgcrypto;

alter table if exists public.algorithm_bets
  add column if not exists analysis_started_at timestamptz;

alter table if exists public.algorithm_bets
  add column if not exists analysis_finished_at timestamptz;

alter table if exists public.algorithm_bets
  add column if not exists analysis_next_retry_at timestamptz;

create index if not exists algorithm_bets_queue_retry_idx
on public.algorithm_bets(analysis_state, analysis_next_retry_at, kickoff asc);

-- Stare rekordy oczekujące mogą zostać przetworzone od razu przez nową wersję.
update public.algorithm_bets
set analysis_next_retry_at = null
where analysis_state = 'waiting_stats';

-- Jedna blokada dla całego automatu. Zapobiega równoległemu uruchamianiu
-- skanu ręcznego, harmonogramu i poprzedniego Background Workera.
create table if not exists public.algorithm_worker_locks (
  lock_name text primary key,
  locked_by text,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.algorithm_worker_locks enable row level security;

insert into public.algorithm_worker_locks(lock_name, locked_by, locked_until)
values ('algorithm-main-worker', null, null)
on conflict (lock_name) do nothing;

create or replace function public.algorithm_try_acquire_worker_lock(
  p_lock_name text,
  p_owner text,
  p_ttl_seconds integer default 1020
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired boolean := false;
begin
  insert into public.algorithm_worker_locks(lock_name, locked_by, locked_until, updated_at)
  values (
    p_lock_name,
    p_owner,
    now() + make_interval(secs => greatest(60, coalesce(p_ttl_seconds, 1020))),
    now()
  )
  on conflict (lock_name) do update
  set locked_by = excluded.locked_by,
      locked_until = excluded.locked_until,
      updated_at = now()
  where public.algorithm_worker_locks.locked_until is null
     or public.algorithm_worker_locks.locked_until < now()
     or public.algorithm_worker_locks.locked_by = excluded.locked_by
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.algorithm_release_worker_lock(
  p_lock_name text,
  p_owner text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released boolean := false;
begin
  update public.algorithm_worker_locks
  set locked_by = null,
      locked_until = null,
      updated_at = now()
  where lock_name = p_lock_name
    and locked_by = p_owner
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

revoke all on function public.algorithm_try_acquire_worker_lock(text, text, integer) from public;
revoke all on function public.algorithm_release_worker_lock(text, text) from public;
grant execute on function public.algorithm_try_acquire_worker_lock(text, text, integer) to service_role;
grant execute on function public.algorithm_release_worker_lock(text, text) to service_role;

alter table if exists public.algorithm_bets
  alter column model_version set default 'pressure-ou25-v5-prematch-throttled-worker';

comment on column public.algorithm_bets.analysis_next_retry_at is
'Najwcześniejszy termin ponowienia po limicie API lub chwilowym braku danych.';

comment on table public.algorithm_worker_locks is
'Blokada zapobiegająca równoległemu działaniu więcej niż jednego workera algorytmu.';
