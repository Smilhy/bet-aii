
-- supabase/version_1043_admin_payouts_hardening.sql
-- Admin Wypłaty 100%:
-- - tabele i kolumny dla payout_requests / user_stripe_accounts / admin_logs,
-- - reject_tipster_payout z admin guard,
-- - RLS i polityki,
-- - kompatybilne z istniejącymi tabelami.

create extension if not exists pgcrypto;

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric not null default 0,
  currency text not null default 'pln',
  status text not null default 'pending',
  stripe_status text,
  stripe_transfer_id text,
  stripe_error text,
  requested_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid,
  processed_at timestamptz,
  rejected_at timestamptz,
  rejected_by uuid,
  reject_reason text
);

alter table public.payout_requests add column if not exists user_id uuid;
alter table public.payout_requests add column if not exists amount numeric not null default 0;
alter table public.payout_requests add column if not exists currency text not null default 'pln';
alter table public.payout_requests add column if not exists status text not null default 'pending';
alter table public.payout_requests add column if not exists stripe_status text;
alter table public.payout_requests add column if not exists stripe_transfer_id text;
alter table public.payout_requests add column if not exists stripe_error text;
alter table public.payout_requests add column if not exists requested_at timestamptz default now();
alter table public.payout_requests add column if not exists created_at timestamptz default now();
alter table public.payout_requests add column if not exists updated_at timestamptz default now();
alter table public.payout_requests add column if not exists approved_at timestamptz;
alter table public.payout_requests add column if not exists approved_by uuid;
alter table public.payout_requests add column if not exists processed_at timestamptz;
alter table public.payout_requests add column if not exists rejected_at timestamptz;
alter table public.payout_requests add column if not exists rejected_by uuid;
alter table public.payout_requests add column if not exists reject_reason text;

create table if not exists public.user_stripe_accounts (
  user_id uuid primary key,
  stripe_account_id text,
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_stripe_accounts add column if not exists stripe_account_id text;
alter table public.user_stripe_accounts add column if not exists charges_enabled boolean default false;
alter table public.user_stripe_accounts add column if not exists payouts_enabled boolean default false;
alter table public.user_stripe_accounts add column if not exists created_at timestamptz default now();
alter table public.user_stripe_accounts add column if not exists updated_at timestamptz default now();

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.admin_logs add column if not exists admin_user_id uuid;
alter table public.admin_logs add column if not exists action text;
alter table public.admin_logs add column if not exists target_table text;
alter table public.admin_logs add column if not exists target_id text;
alter table public.admin_logs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.admin_logs add column if not exists created_at timestamptz default now();

create index if not exists payout_requests_status_amount_idx_v1043
on public.payout_requests (status, amount, created_at);

create index if not exists payout_requests_user_idx_v1043
on public.payout_requests (user_id, created_at desc);

create index if not exists payout_requests_transfer_unique_idx_v1043
on public.payout_requests (stripe_transfer_id)
where stripe_transfer_id is not null;

create index if not exists user_stripe_accounts_account_idx_v1043
on public.user_stripe_accounts (stripe_account_id);

-- Jeśli funkcja admin guard z 1042 istnieje, używamy jej. Jeśli nie, fallback przez profiles/email.
create or replace function public.betai_payout_is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_ok boolean := false;
begin
  if to_regprocedure('public.betai_admin_finance_is_admin()') is not null then
    execute 'select public.betai_admin_finance_is_admin()' into v_ok;
    if coalesce(v_ok,false) then return true; end if;
  end if;

  if v_email in ('smilhytv@gmail.com') then
    return true;
  end if;

  if v_uid is null then
    return false;
  end if;

  if to_regclass('public.profiles') is not null then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_uid
        and (
          coalesce(p.is_admin,false) = true
          or lower(coalesce(p.role,'')) in ('admin','owner','superadmin')
          or lower(coalesce(p.username,'')) = 'smilhytv'
        )
    ) into v_ok;

    if coalesce(v_ok,false) then
      return true;
    end if;
  end if;

  return false;
exception
  when undefined_column then
    return false;
end;
$$;

create or replace function public.reject_tipster_payout(p_request_id uuid, p_reason text default 'Odrzucona przez administratora')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.payout_requests%rowtype;
  v_now timestamptz := now();
begin
  if not public.betai_payout_is_admin() then
    return jsonb_build_object('ok', false, 'error', 'ADMIN_ONLY');
  end if;

  select *
  into v_row
  from public.payout_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'PAYOUT_NOT_FOUND');
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'PAYOUT_ALREADY_PROCESSED', 'status', v_row.status);
  end if;

  update public.payout_requests
  set
    status = 'rejected',
    stripe_status = coalesce(stripe_status, 'not_applicable'),
    rejected_at = v_now,
    rejected_by = auth.uid(),
    reject_reason = p_reason,
    updated_at = v_now
  where id = p_request_id;

  insert into public.admin_logs(admin_user_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    'reject_payout',
    'payout_requests',
    p_request_id::text,
    jsonb_build_object('reason', p_reason, 'user_id', v_row.user_id, 'amount', v_row.amount)
  );

  return jsonb_build_object('ok', true, 'status', 'rejected');
end;
$$;

alter table public.payout_requests enable row level security;
alter table public.user_stripe_accounts enable row level security;
alter table public.admin_logs enable row level security;

drop policy if exists "payout_requests_select_own_or_admin_v1043" on public.payout_requests;
create policy "payout_requests_select_own_or_admin_v1043"
on public.payout_requests
for select
to authenticated
using (user_id = auth.uid() or public.betai_payout_is_admin());

drop policy if exists "payout_requests_insert_own_v1043" on public.payout_requests;
create policy "payout_requests_insert_own_v1043"
on public.payout_requests
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "payout_requests_update_admin_v1043" on public.payout_requests;
create policy "payout_requests_update_admin_v1043"
on public.payout_requests
for update
to authenticated
using (public.betai_payout_is_admin())
with check (public.betai_payout_is_admin());

drop policy if exists "user_stripe_accounts_select_own_or_admin_v1043" on public.user_stripe_accounts;
create policy "user_stripe_accounts_select_own_or_admin_v1043"
on public.user_stripe_accounts
for select
to authenticated
using (user_id = auth.uid() or public.betai_payout_is_admin());

drop policy if exists "user_stripe_accounts_insert_own_v1043" on public.user_stripe_accounts;
create policy "user_stripe_accounts_insert_own_v1043"
on public.user_stripe_accounts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_stripe_accounts_update_own_or_admin_v1043" on public.user_stripe_accounts;
create policy "user_stripe_accounts_update_own_or_admin_v1043"
on public.user_stripe_accounts
for update
to authenticated
using (user_id = auth.uid() or public.betai_payout_is_admin())
with check (user_id = auth.uid() or public.betai_payout_is_admin());

drop policy if exists "admin_logs_select_admin_v1043" on public.admin_logs;
create policy "admin_logs_select_admin_v1043"
on public.admin_logs
for select
to authenticated
using (public.betai_payout_is_admin());

grant execute on function public.reject_tipster_payout(uuid, text) to authenticated;
grant execute on function public.betai_payout_is_admin() to authenticated;

select 'v1043 admin payouts hardening ready' as status;
