-- Bet+AI v140 — TOP LEAGUES + API DAILY BUDGET GUARD
-- Uruchom RAZ w Supabase -> SQL Editor.
--
-- Cel:
-- 1) Symulator AI ma własny dzienny limit requestów i nie może zużyć całego planu API-FOOTBALL.
-- 2) Pozostałe moduły strony zachowują większość dziennego pakietu.
-- 3) Trafienia w cache NIE zwiększają licznika. Liczymy tylko faktyczne próby sieciowe.
--
-- Domyślne limity w kodzie v140:
--   value-scanner   = 240 requestów / dzień
--   simulator-core = 650 requestów / dzień
--   simulator total = 750 requestów / dzień
--
-- Czyli przy planie 7500/dzień Symulator sam z siebie nie powinien przekroczyć ~10% pakietu.

create table if not exists public.match_api_daily_budget (
  budget_date date not null,
  scope text not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (budget_date, scope)
);

create index if not exists idx_match_api_daily_budget_updated
  on public.match_api_daily_budget(updated_at desc);

alter table public.match_api_daily_budget enable row level security;

comment on table public.match_api_daily_budget is
  'Dzienny licznik requestów API-FOOTBALL używanych przez Symulator AI / Value Scanner. Chroni wspólny pakiet całej strony.';

create or replace function public.betai_take_match_api_budget(
  p_scope text,
  p_scope_limit integer default 650,
  p_total_limit integer default 750
)
returns table(
  allowed boolean,
  scope_used integer,
  total_used integer,
  scope_remaining integer,
  total_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_scope text := left(coalesce(nullif(trim(p_scope), ''), 'simulator-core'), 80);
  v_scope_limit integer := greatest(1, least(coalesce(p_scope_limit, 650), 100000));
  v_total_limit integer := greatest(1, least(coalesce(p_total_limit, 750), 100000));
  v_scope_used integer := 0;
  v_total_used integer := 0;
begin
  -- Jeden lock dla całego dziennego budżetu Symulatora, aby równoległe
  -- funkcje Netlify nie przeskoczyły limitu.
  perform pg_advisory_xact_lock(hashtext('betai_match_api_daily_budget_' || v_day::text));

  insert into public.match_api_daily_budget(budget_date, scope, used, updated_at)
  values (v_day, 'simulator-total', 0, now())
  on conflict (budget_date, scope) do nothing;

  insert into public.match_api_daily_budget(budget_date, scope, used, updated_at)
  values (v_day, v_scope, 0, now())
  on conflict (budget_date, scope) do nothing;

  select used
    into v_total_used
    from public.match_api_daily_budget
   where budget_date = v_day
     and scope = 'simulator-total'
   for update;

  select used
    into v_scope_used
    from public.match_api_daily_budget
   where budget_date = v_day
     and scope = v_scope
   for update;

  if v_total_used >= v_total_limit or v_scope_used >= v_scope_limit then
    allowed := false;
    scope_used := v_scope_used;
    total_used := v_total_used;
    scope_remaining := greatest(0, v_scope_limit - v_scope_used);
    total_remaining := greatest(0, v_total_limit - v_total_used);
    return next;
    return;
  end if;

  update public.match_api_daily_budget
     set used = used + 1,
         updated_at = now()
   where budget_date = v_day
     and scope = 'simulator-total'
   returning used into v_total_used;

  update public.match_api_daily_budget
     set used = used + 1,
         updated_at = now()
   where budget_date = v_day
     and scope = v_scope
   returning used into v_scope_used;

  allowed := true;
  scope_used := v_scope_used;
  total_used := v_total_used;
  scope_remaining := greatest(0, v_scope_limit - v_scope_used);
  total_remaining := greatest(0, v_total_limit - v_total_used);
  return next;
end;
$$;

revoke all
  on function public.betai_take_match_api_budget(text, integer, integer)
  from public;

revoke all
  on function public.betai_take_match_api_budget(text, integer, integer)
  from anon;

revoke all
  on function public.betai_take_match_api_budget(text, integer, integer)
  from authenticated;

grant execute
  on function public.betai_take_match_api_budget(text, integer, integer)
  to service_role;

-- Podgląd wykorzystania dzisiejszego budżetu:
-- select * from public.match_api_daily_budget
-- where budget_date = (now() at time zone 'UTC')::date
-- order by scope;
