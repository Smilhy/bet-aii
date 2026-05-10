-- BETAI SQL 830 — realny raport Admin Finanse
-- Rozszerza raport o:
-- premium_revenue, total_platform_revenue, wallet_topups, active_premium_users
-- oraz łączy ostatnie operacje z marketplace, premium, wpłat i wypłat.

DROP FUNCTION IF EXISTS public.get_admin_finance_report();

CREATE OR REPLACE FUNCTION public.get_admin_finance_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean := false;
  v_platform_commission numeric := 0;
  v_total_sales integer := 0;
  v_gross_sales numeric := 0;
  v_tipster_earnings numeric := 0;
  v_total_payouts numeric := 0;
  v_pending_payouts numeric := 0;
  v_available_to_payout numeric := 0;
  v_premium_revenue numeric := 0;
  v_wallet_topups numeric := 0;
  v_active_premium_users integer := 0;
  v_transactions jsonb := '[]'::jsonb;
BEGIN
  SELECT coalesce(is_admin, false)
  INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT coalesce(v_is_admin, false) THEN
    RAISE EXCEPTION 'ADMIN_ONLY';
  END IF;

  SELECT
    coalesce(sum(coalesce(commission, 0)), 0),
    count(*),
    coalesce(sum(coalesce(gross_amount, amount + coalesce(commission, 0), 0)), 0),
    coalesce(sum(coalesce(amount, 0)), 0)
  INTO v_platform_commission, v_total_sales, v_gross_sales, v_tipster_earnings
  FROM public.earnings
  WHERE coalesce(status, 'available') IN ('available', 'paid', 'completed');

  SELECT
    coalesce(sum(case when status in ('paid', 'approved') then amount else 0 end), 0),
    coalesce(sum(case when status = 'pending' then amount else 0 end), 0)
  INTO v_total_payouts, v_pending_payouts
  FROM public.payout_requests;

  v_available_to_payout := greatest(0, v_tipster_earnings - v_total_payouts - v_pending_payouts);

  SELECT coalesce(sum(amount), 0)
  INTO v_premium_revenue
  FROM public.payments
  WHERE coalesce(status, 'paid') IN ('paid', 'completed', 'succeeded')
    AND (
      lower(coalesce(provider, '')) like '%premium%'
      OR lower(coalesce(kind, '')) like '%premium%'
      OR lower(coalesce(type, '')) like '%premium%'
    );

  SELECT coalesce(sum(amount), 0)
  INTO v_wallet_topups
  FROM public.wallet_transactions
  WHERE type = 'topup'
    AND coalesce(status, 'completed') IN ('completed', 'paid', 'succeeded');

  SELECT count(*)
  INTO v_active_premium_users
  FROM public.profiles
  WHERE coalesce(is_premium, false) = true
    AND coalesce(current_period_end, now() + interval '1 day') > now();

  WITH recent_rows AS (
    SELECT
      e.id::text AS id,
      e.created_at,
      e.tipster_id AS user_id,
      p.email AS user_email,
      'earning'::text AS type,
      coalesce(e.amount, 0) AS amount,
      coalesce(e.status, 'completed') AS status
    FROM public.earnings e
    LEFT JOIN public.profiles p ON p.id = e.tipster_id

    UNION ALL

    SELECT
      pay.id::text AS id,
      pay.created_at,
      pay.user_id,
      p.email AS user_email,
      'premium_payment'::text AS type,
      coalesce(pay.amount, 0) AS amount,
      coalesce(pay.status, 'paid') AS status
    FROM public.payments pay
    LEFT JOIN public.profiles p ON p.id = pay.user_id
    WHERE lower(coalesce(pay.provider, '')) like '%premium%'
       OR lower(coalesce(pay.kind, '')) like '%premium%'
       OR lower(coalesce(pay.type, '')) like '%premium%'

    UNION ALL

    SELECT
      wt.id::text AS id,
      wt.created_at,
      wt.user_id,
      p.email AS user_email,
      'topup'::text AS type,
      coalesce(wt.amount, 0) AS amount,
      coalesce(wt.status, 'completed') AS status
    FROM public.wallet_transactions wt
    LEFT JOIN public.profiles p ON p.id = wt.user_id
    WHERE wt.type = 'topup'

    UNION ALL

    SELECT
      pr.id::text AS id,
      pr.created_at,
      pr.user_id,
      p.email AS user_email,
      'payout'::text AS type,
      coalesce(pr.amount, 0) AS amount,
      coalesce(pr.status, 'pending') AS status
    FROM public.payout_requests pr
    LEFT JOIN public.profiles p ON p.id = pr.user_id
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'created_at', created_at,
        'user_id', user_id,
        'user_email', user_email,
        'type', type,
        'amount', amount,
        'status', status
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_transactions
  FROM (
    SELECT *
    FROM recent_rows
    ORDER BY created_at DESC
    LIMIT 30
  ) limited_rows;

  RETURN jsonb_build_object(
    'platform_commission', v_platform_commission,
    'premium_revenue', v_premium_revenue,
    'total_platform_revenue', v_platform_commission + v_premium_revenue,
    'total_sales', v_total_sales,
    'gross_sales', v_gross_sales,
    'tipster_earnings', v_tipster_earnings,
    'total_payouts', v_total_payouts,
    'pending_payouts', v_pending_payouts,
    'available_to_payout', v_available_to_payout,
    'wallet_topups', v_wallet_topups,
    'active_premium_users', v_active_premium_users,
    'transactions', v_transactions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_finance_report() TO authenticated;

-- Kontrola jako admin:
SELECT public.get_admin_finance_report();
