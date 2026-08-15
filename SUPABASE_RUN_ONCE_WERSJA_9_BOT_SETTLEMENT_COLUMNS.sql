-- BETAI WERSJA 9 — KOLUMNY WYMAGANE PRZEZ AUTOMATYCZNE ROZLICZANIE BOTÓW
-- Uruchom jeden raz w Supabase -> SQL Editor.

begin;

alter table if exists public.tips add column if not exists result text;
alter table if exists public.tips add column if not exists settlement_status text;
alter table if exists public.tips add column if not exists result_status text;
alter table if exists public.tips add column if not exists profit numeric default 0;
alter table if exists public.tips add column if not exists payout numeric default 0;
alter table if exists public.tips add column if not exists return_amount numeric default 0;
alter table if exists public.tips add column if not exists settlement_reason text;
alter table if exists public.tips add column if not exists settled_at timestamptz;
alter table if exists public.tips add column if not exists updated_at timestamptz default now();
alter table if exists public.tips add column if not exists fixture_id text;
alter table if exists public.tips add column if not exists api_fixture_id text;
alter table if exists public.tips add column if not exists external_fixture_id text;
alter table if exists public.tips add column if not exists market_key text;
alter table if exists public.tips add column if not exists selection_key text;
alter table if exists public.tips add column if not exists legs_json jsonb;

create index if not exists tips_bot_pending_author_created_idx
  on public.tips (author_name, created_at desc)
  where status is null or lower(status) in ('pending', 'live');

commit;

-- Kontrola: pokaż nierozliczone typy trzech botów.
select
  id,
  author_name,
  team_home,
  team_away,
  bet_type,
  fixture_id,
  status,
  settlement_status,
  created_at
from public.tips
where author_name in ('BetAI MultiSport AI', 'Typer Expert', 'Ograć Buka')
  and (
    status is null
    or lower(status) in ('pending', 'live')
    or settlement_status is null
    or lower(settlement_status) in ('pending', 'live')
  )
order by created_at desc;
