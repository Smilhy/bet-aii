-- WERSJA 1319 — Admin finanse: Premium + marketplace revenue split
-- Cel:
-- - zakup typu od innego użytkownika z payments.tip_id ma być marketplace,
-- - marketplace brutto = suma płatności za typy,
-- - prowizja platformy = 20%,
-- - zarobki typerów = 80%,
-- - premium platformy = płatności premium bez tip_id,
-- - wpłaty do portfela są przepływem, nie zyskiem.

create or replace function public.get_admin_finance_report()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_admin boolean := false;
  v_premium_revenue numeric := 0;
  v_platform_commission numeric := 0;
  v_total_platform_revenue numeric := 0;
  v_total_sales integer := 0;
  v_gross_sales numeric := 0;
  v_tipster_earnings numeric := 0;
  v_total_payouts numeric := 0;
  v_pending_payouts numeric := 0;
  v_available_to_payout numeric := 0;
  v_wallet_topups numeric := 0;
  v_active_premium_users integer := 0;
  v_transactions jsonb := '[]'::jsonb;
begin
  v_is_admin := public.betai_admin_finance_is_admin();

  if not v_is_admin then
    return jsonb_build_object(
      'ok', false,
      'admin_denied', true,
      'error', 'Brak dostępu. Raport finansowy jest dostępny tylko dla administratora.',
      'generated_at', now(),
      'platform_commission', 0,
      'premium_revenue', 0,
      'total_platform_revenue', 0,
      'total_sales', 0,
      'gross_sales', 0,
      'tipster_earnings', 0,
      'total_payouts', 0,
      'pending_payouts', 0,
      'available_to_payout', 0,
      'wallet_topups', 0,
      'active_premium_users', 0,
      'transactions', '[]'::jsonb
    );
  end if;

  if to_regclass('public.profiles') is not null then
    select count(*)::int
      into v_active_premium_users
    from public.profiles
    where coalesce(is_premium, false) = true
       or lower(coalesce(plan, '')) in ('premium', 'vip', 'pro', 'admin')
       or lower(coalesce(subscription_status, '')) in ('active', 'trialing', 'premium');
  end if;

  if to_regclass('public.payments') is not null then
    -- Premium platformy: płatność premium bez tip_id.
    select coalesce(sum(amount), 0)
      into v_premium_revenue
    from public.payments
    where lower(coalesce(status, 'completed')) in ('paid', 'succeeded', 'completed', 'success', 'active')
      and tip_id is null
      and lower(coalesce(provider, '')) like '%premium%';

    -- Marketplace: zakup typu / sprzedaż między użytkownikami.
    select coalesce(sum(amount), 0), count(*)::int
      into v_gross_sales, v_total_sales
    from public.payments
    where lower(coalesce(status, 'completed')) in ('paid', 'succeeded', 'completed', 'success', 'active')
      and (
        tip_id is not null
        or lower(coalesce(provider, '')) like '%tip%'
        or lower(coalesce(provider, '')) like '%market%'
        or lower(coalesce(provider, '')) like '%single%'
        or lower(coalesce(provider, '')) like '%profile_subscription%'
        or lower(coalesce(provider, '')) like '%creator_subscription%'
      );

    -- Wpłaty do portfeli: przepływ środków, nie zysk.
    select coalesce(sum(amount), 0)
      into v_wallet_topups
    from public.payments
    where lower(coalesce(status, 'completed')) in ('paid', 'succeeded', 'completed', 'success', 'active')
      and (
        lower(coalesce(provider, '')) like '%topup%'
        or lower(coalesce(provider, '')) like '%deposit%'
        or lower(coalesce(provider, '')) like '%wallet_topup%'
      );
  end if;

  v_platform_commission := round(coalesce(v_gross_sales, 0) * 0.20, 2);
  v_tipster_earnings := round(coalesce(v_gross_sales, 0) * 0.80, 2);

  if to_regclass('public.payout_requests') is not null then
    select
      coalesce(sum(case when lower(coalesce(status, 'pending')) in ('paid', 'approved', 'completed', 'succeeded') then amount else 0 end), 0),
      coalesce(sum(case when lower(coalesce(status, 'pending')) in ('pending', 'processing', 'requested') then amount else 0 end), 0)
      into v_total_payouts, v_pending_payouts
    from public.payout_requests;
  end if;

  v_available_to_payout := greatest(0, coalesce(v_tipster_earnings, 0) - coalesce(v_total_payouts, 0) - coalesce(v_pending_payouts, 0));
  v_total_platform_revenue := coalesce(v_premium_revenue, 0) + coalesce(v_platform_commission, 0);

  -- Ostatnie operacje: payments + wallet_transactions + payout_requests.
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
    into v_transactions
  from (
    select
      id::text,
      created_at,
      case
        when tip_id is not null then 'tip_purchase'
        when lower(coalesce(provider, '')) like '%premium%' then 'premium_purchase'
        else coalesce(provider, 'payment')
      end as type,
      case when tip_id is not null then 'marketplace_payment' else 'payments' end as source,
      user_id::text,
      null::text as user_email,
      amount,
      status,
      tip_id::text,
      provider
    from public.payments
    where lower(coalesce(status, 'completed')) in ('paid', 'succeeded', 'completed', 'success', 'active')
    order by created_at desc
    limit 80
  ) t;

  return jsonb_build_object(
    'ok', true,
    'source', 'get_admin_finance_report_v1319_premium_marketplace',
    'generated_at', now(),
    'platform_commission', coalesce(v_platform_commission, 0),
    'premium_revenue', coalesce(v_premium_revenue, 0),
    'total_platform_revenue', coalesce(v_total_platform_revenue, 0),
    'total_sales', coalesce(v_total_sales, 0),
    'gross_sales', coalesce(v_gross_sales, 0),
    'tipster_earnings', coalesce(v_tipster_earnings, 0),
    'total_payouts', coalesce(v_total_payouts, 0),
    'pending_payouts', coalesce(v_pending_payouts, 0),
    'available_to_payout', coalesce(v_available_to_payout, 0),
    'wallet_topups', coalesce(v_wallet_topups, 0),
    'active_premium_users', coalesce(v_active_premium_users, 0),
    'transactions', v_transactions
  );
end;
$$;

revoke all on function public.get_admin_finance_report() from public;
grant execute on function public.get_admin_finance_report() to authenticated;
