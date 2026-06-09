
-- supabase/version_1038_auto_settle_hard_fix_diagnostics.sql
-- Mocniejszy automat rozliczania + diagnostyka.
-- Naprawia przypadki:
-- - rekord ma api_fixture_id zamiast fixture_id,
-- - status jest zapisany jako oczekujący/pending/open/active,
-- - potrzeba ręcznie odpalić diagnostykę Netlify Function.

create extension if not exists pgcrypto;

alter table if exists public.tips add column if not exists fixture_id text;
alter table if exists public.tips add column if not exists api_fixture_id text;
alter table if exists public.tips add column if not exists external_fixture_id text;
alter table if exists public.tips add column if not exists settlement_status text;
alter table if exists public.tips add column if not exists result_status text;
alter table if exists public.tips add column if not exists result text;
alter table if exists public.tips add column if not exists settlement_source text;
alter table if exists public.tips add column if not exists settlement_note text;
alter table if exists public.tips add column if not exists final_score_home integer;
alter table if exists public.tips add column if not exists final_score_away integer;
alter table if exists public.tips add column if not exists result_home integer;
alter table if exists public.tips add column if not exists result_away integer;
alter table if exists public.tips add column if not exists payout numeric default 0;
alter table if exists public.tips add column if not exists return_amount numeric default 0;
alter table if exists public.tips add column if not exists profit numeric default 0;
alter table if exists public.tips add column if not exists settled_at timestamptz;
alter table if exists public.tips add column if not exists settled_by text;
alter table if exists public.tips add column if not exists fixture_status text;
alter table if exists public.tips add column if not exists fixture_json jsonb;
alter table if exists public.tips add column if not exists manual_settlement_status text;
alter table if exists public.tips add column if not exists admin_approval_status text;

-- Ujednolicenie ID fixture dla starych i nowych kuponów.
update public.tips
set
  fixture_id = coalesce(fixture_id, api_fixture_id, external_fixture_id),
  api_fixture_id = coalesce(api_fixture_id, fixture_id, external_fixture_id),
  external_fixture_id = coalesce(external_fixture_id, fixture_id, api_fixture_id),
  settlement_source = coalesce(settlement_source, 'api-football'),
  settlement_status = coalesce(settlement_status, status, 'pending')
where coalesce(fixture_id, api_fixture_id, external_fixture_id) is not null
  and coalesce(fixture_id, api_fixture_id, external_fixture_id)::text not like 'manual-%'
  and lower(coalesce(status, 'pending')) not in ('won', 'lost', 'void', 'wygrany', 'przegrany', 'zwrot');

create index if not exists tips_auto_settle_any_fixture_idx_v1038
on public.tips (created_at desc, status, settlement_status)
where coalesce(fixture_id, api_fixture_id, external_fixture_id) is not null;

create or replace view public.tips_auto_settle_pending_v1038 as
select
  id,
  created_at,
  status,
  settlement_status,
  result_status,
  result,
  fixture_id,
  api_fixture_id,
  external_fixture_id,
  team_home,
  team_away,
  bet_type,
  prediction,
  market,
  type,
  odds,
  stake,
  settled_at,
  settled_by,
  fixture_status,
  settlement_note
from public.tips
where coalesce(fixture_id, api_fixture_id, external_fixture_id) is not null
  and lower(coalesce(status, 'pending')) not in ('won', 'lost', 'void', 'wygrany', 'przegrany', 'zwrot')
order by created_at desc;

select 'v1038 auto settle hard fix diagnostics ready' as status;
