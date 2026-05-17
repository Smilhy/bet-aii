
-- supabase/version_1035_auto_settle_api_football.sql
-- Automatyczne rozliczanie typów API-Football:
-- - typ z fixture_id/api_fixture_id => status pending i może być rozliczony automatem,
-- - typ ręczny bez fixture_id => pending_admin_review / do sprawdzenia przez admina,
-- - auto-settle aktualizuje status, wynik, profit, payout i settled_at,
-- - ręczne rozliczanie zostaje jako admin override.

create extension if not exists pgcrypto;

alter table if exists public.tips
  add column if not exists fixture_id text;

alter table if exists public.tips
  add column if not exists api_fixture_id text;

alter table if exists public.tips
  add column if not exists external_fixture_id text;

alter table if exists public.tips
  add column if not exists tip_source text;

alter table if exists public.tips
  add column if not exists settlement_status text;

alter table if exists public.tips
  add column if not exists settlement_source text;

alter table if exists public.tips
  add column if not exists settlement_note text;

alter table if exists public.tips
  add column if not exists final_score_home integer;

alter table if exists public.tips
  add column if not exists final_score_away integer;

alter table if exists public.tips
  add column if not exists result_home integer;

alter table if exists public.tips
  add column if not exists result_away integer;

alter table if exists public.tips
  add column if not exists payout numeric default 0;

alter table if exists public.tips
  add column if not exists return_amount numeric default 0;

alter table if exists public.tips
  add column if not exists profit numeric default 0;

alter table if exists public.tips
  add column if not exists settled_at timestamptz;

alter table if exists public.tips
  add column if not exists settled_by text;

alter table if exists public.tips
  add column if not exists fixture_status text;

alter table if exists public.tips
  add column if not exists fixture_json jsonb;

-- Jeżeli masz stare typy z fixture_id, ustaw je jako API pending.
update public.tips
set
  api_fixture_id = coalesce(api_fixture_id, fixture_id, external_fixture_id),
  external_fixture_id = coalesce(external_fixture_id, fixture_id, api_fixture_id),
  tip_source = coalesce(tip_source, 'api-football'),
  settlement_source = coalesce(settlement_source, 'api-football'),
  settlement_status = coalesce(settlement_status, status, 'pending')
where coalesce(fixture_id, api_fixture_id, external_fixture_id) is not null
  and coalesce(fixture_id, api_fixture_id, external_fixture_id)::text not like 'manual-%'
  and coalesce(status, 'pending') in ('pending', 'open', 'active');

-- Typy bez fixture_id nie mogą być rozliczane automatem.
update public.tips
set
  tip_source = coalesce(tip_source, 'manual_admin_review'),
  settlement_source = coalesce(settlement_source, 'manual_admin_review'),
  settlement_status = coalesce(settlement_status, 'pending_admin_review'),
  status = case
    when coalesce(status, 'pending') in ('pending', 'open', 'active') then 'pending_admin_review'
    else status
  end
where coalesce(fixture_id, api_fixture_id, external_fixture_id) is null
  and coalesce(status, 'pending') in ('pending', 'open', 'active');

create index if not exists tips_auto_settle_fixture_idx
on public.tips (status, fixture_id)
where fixture_id is not null;

create index if not exists tips_auto_settle_api_fixture_idx
on public.tips (status, api_fixture_id)
where api_fixture_id is not null;

create index if not exists tips_pending_admin_review_idx
on public.tips (status, settlement_status)
where status = 'pending_admin_review';

-- Widok dla admina: ręczne typy do sprawdzenia.
create or replace view public.tips_pending_admin_review_v1035 as
select *
from public.tips
where coalesce(status, '') = 'pending_admin_review'
   or coalesce(settlement_status, '') = 'pending_admin_review'
order by created_at desc;

select 'v1035 auto settle api-football ready' as status;
