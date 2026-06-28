-- WERSJA 1428 — ADMIN FINANSE LIGHT RPC / STOP 400 Z TIPS/PROFILES
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - Admin finanse ma pobierać jeden lekki raport z RPC,
-- - frontend nie musi już robić serii zapytań payments -> tips -> profiles,
-- - mniej czerwonych 400 i mniej zapytań po wejściu w Admin finanse.
--
-- Nie usuwa danych.

create extension if not exists pgcrypto;

create index if not exists payments_created_at_idx
  on public.payments (created_at desc);

create index if not exists payments_status_created_idx
  on public.payments (status, created_at desc);

create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

create index if not exists payments_tip_created_idx
  on public.payments (tip_id, created_at desc);

create index if not exists user_stripe_accounts_user_idx
  on public.user_stripe_accounts (user_id);

create index if not exists tipster_subscriptions_tipster_created_idx
  on public.tipster_subscriptions (tipster_id, created_at desc);

create index if not exists payout_requests_status_created_idx
  on public.payout_requests (status, created_at desc);

drop function if exists public.get_admin_finance_report();

create function public.get_admin_finance_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;

  v_premium_revenue numeric := 0;
  v_wallet_topups numeric := 0;
  v_gross_sales numeric := 0;
  v_total_sales integer := 0;
  v_platform_commission numeric := 0;
  v_tipster_earnings numeric := 0;
  v_total_payouts numeric := 0;
  v_pending_payouts numeric := 0;
  v_active_premium_users integer := 0;
  v_transactions jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'admin_denied', true, 'error', 'not authenticated');
  end if;

  select coalesce(is_admin, false)
    into v_is_admin
  from public.profiles
  where id = v_uid
  limit 1;

  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'admin_denied', true, 'error', 'admin only');
  end if;

  -- Lekki licznik płatności, bez JOIN do tips/profiles.
  select
    coalesce(sum(
      case
        when lower(coalesce(provider, '')) like '%premium%'
          or lower(coalesce(provider, '')) like '%subscription%'
        then amount else 0 end
    ), 0),
    coalesce(sum(
      case
        when lower(coalesce(provider, '')) like '%topup%'
          or lower(coalesce(provider, '')) like '%deposit%'
          or lower(coalesce(provider, '')) like '%wallet%'
        then amount else 0 end
    ), 0),
    coalesce(sum(
      case
        when tip_id is not null
          or lower(coalesce(provider, '')) like '%tip%'
          or lower(coalesce(provider, '')) like '%marketplace%'
          or lower(coalesce(provider, '')) like '%single%'
        then amount else 0 end
    ), 0),
    count(*) filter (
      where tip_id is not null
        or lower(coalesce(provider, '')) like '%tip%'
        or lower(coalesce(provider, '')) like '%marketplace%'
        or lower(coalesce(provider, '')) like '%single%'
    )
  into
    v_premium_revenue,
    v_wallet_topups,
    v_gross_sales,
    v_total_sales
  from public.payments
  where lower(coalesce(status, 'completed')) in ('paid','succeeded','completed','success','active');

  v_platform_commission := round(coalesce(v_gross_sales, 0) * 0.20, 2);
  v_tipster_earnings := round(coalesce(v_gross_sales, 0) * 0.80, 2);

  begin
    select
      coalesce(sum(case when lower(coalesce(status,'')) in ('paid','completed','approved') then amount else 0 end), 0),
      coalesce(sum(case when lower(coalesce(status,'')) in ('pending','requested') then amount else 0 end), 0)
    into v_total_payouts, v_pending_payouts
    from public.payout_requests;
  exception when others then
    v_total_payouts := 0;
    v_pending_payouts := 0;
  end;

  begin
    select count(*)::integer
      into v_active_premium_users
    from public.profiles
    where coalesce(is_premium, false) = true
      or lower(coalesce(plan, '')) = 'premium'
      or lower(coalesce(subscription_status, '')) in ('premium','active','trialing');
  exception when others then
    v_active_premium_users := 0;
  end;

  begin
    select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb)
      into v_transactions
    from (
      select jsonb_build_object(
        'id', p.id,
        'created_at', p.created_at,
        'type',
          case
            when p.tip_id is not null then 'tip_purchase'
            when lower(coalesce(p.provider,'')) like '%premium%' then 'premium_purchase'
            when lower(coalesce(p.provider,'')) like '%topup%' then 'wallet_topup'
            else coalesce(p.provider, 'payment')
          end,
        'source', 'payments_light',
        'provider', p.provider,
        'tip_id', p.tip_id,
        'user_id', p.user_id,
        'amount', p.amount,
        'status', p.status,
        'display_user', coalesce(pr.username, pr.email, p.user_id::text, '—')
      ) as x
      from public.payments p
      left join public.profiles pr on pr.id = p.user_id
      order by p.created_at desc
      limit 60
    ) s;
  exception when others then
    v_transactions := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'ok', true,
    'source', 'get_admin_finance_report_v1428_light',
    'generated_at', now(),
    'premium_revenue', coalesce(v_premium_revenue, 0),
    'wallet_topups', coalesce(v_wallet_topups, 0),
    'gross_sales', coalesce(v_gross_sales, 0),
    'total_sales', coalesce(v_total_sales, 0),
    'platform_commission', coalesce(v_platform_commission, 0),
    'tipster_earnings', coalesce(v_tipster_earnings, 0),
    'total_payouts', coalesce(v_total_payouts, 0),
    'pending_payouts', coalesce(v_pending_payouts, 0),
    'available_to_payout', greatest(0, coalesce(v_tipster_earnings, 0) - coalesce(v_total_payouts, 0) - coalesce(v_pending_payouts, 0)),
    'total_platform_revenue', coalesce(v_platform_commission, 0) + coalesce(v_premium_revenue, 0),
    'active_premium_users', coalesce(v_active_premium_users, 0),
    'transactions', coalesce(v_transactions, '[]'::jsonb),
    'marketplace_sales', '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_admin_finance_report() to authenticated;

notify pgrst, 'reload schema';

select 'WERSJA 1428 admin finance light RPC ready' as status;
