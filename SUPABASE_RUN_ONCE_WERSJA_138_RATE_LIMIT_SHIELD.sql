-- Bet+AI v138 — Rate Limit Shield / shared API-Football cache
-- Uruchom RAZ w Supabase -> SQL Editor.
-- Service Role czyta/zapisuje cache. Brak publicznych polityk jest celowy.

create table if not exists public.match_simulator_api_cache (
  cache_key text primary key,
  endpoint text not null default '',
  query_params jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_match_simulator_api_cache_expires
  on public.match_simulator_api_cache(expires_at);

alter table public.match_simulator_api_cache enable row level security;

comment on table public.match_simulator_api_cache is
  'Wspólny cache API-Football dla Symulatora AI. Chroni limit requestów i pozwala używać ostatnich poprawnych danych przy 429.';

create table if not exists public.match_simulator_api_rate_state (
  id text primary key,
  next_allowed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.match_simulator_api_rate_state(id, next_allowed_at, updated_at)
values ('api-football', now(), now())
on conflict (id) do nothing;

alter table public.match_simulator_api_rate_state enable row level security;

-- Atomowa rezerwacja slotu API. 275 ms = maks. ok. 218 requestów/min,
-- czyli bezpieczny zapas względem limitu 300/min.
create or replace function public.betai_reserve_match_api_slot(p_spacing_ms integer default 275)
returns table(wait_ms integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
  v_reserved timestamptz;
  v_spacing integer := greatest(220, least(coalesce(p_spacing_ms, 275), 1000));
begin
  perform pg_advisory_xact_lock(hashtext('betai_match_simulator_api_football_rate_slot'));

  select next_allowed_at
    into v_next
    from public.match_simulator_api_rate_state
   where id = 'api-football'
   for update;

  if v_next is null then
    v_next := v_now;
    insert into public.match_simulator_api_rate_state(id, next_allowed_at, updated_at)
    values ('api-football', v_now, v_now)
    on conflict (id) do nothing;
  end if;

  v_reserved := greatest(v_now, v_next);

  update public.match_simulator_api_rate_state
     set next_allowed_at = v_reserved + (v_spacing::text || ' milliseconds')::interval,
         updated_at = v_now
   where id = 'api-football';

  wait_ms := greatest(0, ceil(extract(epoch from (v_reserved - v_now)) * 1000)::integer);
  return next;
end;
$$;

revoke all on function public.betai_reserve_match_api_slot(integer) from public;
revoke all on function public.betai_reserve_match_api_slot(integer) from anon;
revoke all on function public.betai_reserve_match_api_slot(integer) from authenticated;
grant execute on function public.betai_reserve_match_api_slot(integer) to service_role;

-- Opcjonalne ręczne sprzątanie starego cache (nie trzeba uruchamiać teraz):
-- delete from public.match_simulator_api_cache where expires_at < now() - interval '3 days';
