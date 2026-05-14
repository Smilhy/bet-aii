
-- supabase/version_1042_admin_finance_real_report_and_guard.sql
-- Admin Finanse 100%:
-- - twardy admin guard w RPC,
-- - raport z kilku tabel, jeśli istnieją,
-- - kompatybilny z brakującymi tabelami/kolumnami,
-- - nie dotyka auto-settle/API-Football/społeczności.

create extension if not exists pgcrypto;

create or replace function public.betai_table_exists(p_table text)
returns boolean
language sql
stable
as $$
  select to_regclass('public.' || p_table) is not null;
$$;

create or replace function public.betai_column_exists(p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_column
  );
$$;

create or replace function public.betai_first_existing_column(p_table text, p_columns text[])
returns text
language plpgsql
stable
as $$
declare
  c text;
begin
  foreach c in array p_columns loop
    if public.betai_column_exists(p_table, c) then
      return c;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.betai_admin_finance_is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_is_admin boolean := false;
  v_sql text;
begin
  if v_email in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then
    -- buchajson zostawiony jako fallback jeśli testujesz finanse na drugim koncie.
    -- Jeśli ma być tylko smilhytv, usuń buchajson1988@gmail.com z tej listy.
    return true;
  end if;

  if v_uid is null then
    return false;
  end if;

  if to_regclass('public.profiles') is not null then
    v_sql := 'select exists (select 1 from public.profiles where id = $1 and (false';

    if public.betai_column_exists('profiles', 'is_admin') then
      v_sql := v_sql || ' or coalesce(is_admin,false) = true';
    end if;
    if public.betai_column_exists('profiles', 'role') then
      v_sql := v_sql || ' or lower(coalesce(role, '''')) in (''admin'', ''owner'', ''superadmin'')';
    end if;
    if public.betai_column_exists('profiles', 'app_role') then
      v_sql := v_sql || ' or lower(coalesce(app_role, '''')) in (''admin'', ''owner'', ''superadmin'')';
    end if;
    if public.betai_column_exists('profiles', 'account_role') then
      v_sql := v_sql || ' or lower(coalesce(account_role, '''')) in (''admin'', ''owner'', ''superadmin'')';
    end if;
    if public.betai_column_exists('profiles', 'email') then
      v_sql := v_sql || ' or lower(coalesce(email, '''')) = ''smilhytv@gmail.com''';
    end if;
    if public.betai_column_exists('profiles', 'username') then
      v_sql := v_sql || ' or lower(coalesce(username, '''')) = ''smilhytv''';
    end if;

    v_sql := v_sql || '))';

    execute v_sql using v_uid into v_is_admin;
    if coalesce(v_is_admin,false) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

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
  v_tmp jsonb := '[]'::jsonb;

  t_amount text;
  t_status text;
  t_type text;
  t_created text;
  t_user text;
  t_email text;

  v_sql text;
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

  -- Aktywne premium users z profiles
  if to_regclass('public.profiles') is not null then
    v_sql := 'select count(*) from public.profiles where false';
    if public.betai_column_exists('profiles', 'is_premium') then
      v_sql := v_sql || ' or coalesce(is_premium,false) = true';
    end if;
    if public.betai_column_exists('profiles', 'plan') then
      v_sql := v_sql || ' or lower(coalesce(plan, '''')) in (''premium'', ''vip'', ''pro'', ''admin'')';
    end if;
    if public.betai_column_exists('profiles', 'status') then
      v_sql := v_sql || ' or lower(coalesce(status, '''')) in (''premium'', ''active'', ''trialing'', ''admin'')';
    end if;
    if public.betai_column_exists('profiles', 'subscription_status') then
      v_sql := v_sql || ' or lower(coalesce(subscription_status, '''')) in (''active'', ''trialing'', ''premium'')';
    end if;
    execute v_sql into v_active_premium_users;
  end if;

  -- PAYMENTS: Premium + marketplace, jeśli tabela istnieje
  if to_regclass('public.payments') is not null then
    t_amount := public.betai_first_existing_column('payments', array['amount','price','total','total_amount','gross_amount','payment_amount']);
    t_status := public.betai_first_existing_column('payments', array['status','payment_status','stripe_status']);
    t_type := public.betai_first_existing_column('payments', array['type','payment_type','source','kind','product_type']);
    t_created := public.betai_first_existing_column('payments', array['created_at','paid_at','updated_at']);
    t_user := public.betai_first_existing_column('payments', array['user_id','buyer_id','payer_id','profile_id']);
    t_email := public.betai_first_existing_column('payments', array['user_email','email','buyer_email','customer_email']);

    if t_amount is not null then
      -- Premium revenue
      v_sql := 'select coalesce(sum((' || quote_ident(t_amount) || ')::numeric),0) from public.payments where true';
      if t_status is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_status) || '::text, '''')) in (''paid'', ''succeeded'', ''completed'', ''active'', ''success'')';
      end if;
      if t_type is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%premium%''';
      else
        v_sql := v_sql || ' and false';
      end if;
      execute v_sql into v_premium_revenue;

      -- Marketplace gross
      v_sql := 'select coalesce(sum((' || quote_ident(t_amount) || ')::numeric),0), count(*) from public.payments where true';
      if t_status is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_status) || '::text, '''')) in (''paid'', ''succeeded'', ''completed'', ''success'')';
      end if;
      if t_type is not null then
        v_sql := v_sql || ' and (lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%tip%'' or lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%market%'' or lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%single%'')';
      else
        v_sql := v_sql || ' and false';
      end if;
      execute v_sql into v_gross_sales, v_total_sales;

      -- transactions from payments
      v_sql := 'select coalesce(jsonb_agg(jsonb_build_object(' ||
        quote_literal('id') || ', id::text, ' ||
        quote_literal('created_at') || ', ' || coalesce(quote_ident(t_created), 'now()') || ', ' ||
        quote_literal('type') || ', coalesce(' || coalesce(quote_ident(t_type) || '::text', quote_literal('payment')) || ', ''payment''), ' ||
        quote_literal('source') || ', ''payments'', ' ||
        quote_literal('user_id') || ', ' || coalesce(quote_ident(t_user) || '::text', 'null') || ', ' ||
        quote_literal('user_email') || ', ' || coalesce(quote_ident(t_email) || '::text', 'null') || ', ' ||
        quote_literal('amount') || ', (' || quote_ident(t_amount) || ')::numeric, ' ||
        quote_literal('status') || ', coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('completed')) || ', ''completed'')' ||
        ') order by ' || coalesce(quote_ident(t_created), 'now()') || ' desc), ''[]''::jsonb) from (select * from public.payments order by ' || coalesce(quote_ident(t_created), 'id') || ' desc limit 20) p';
      execute v_sql into v_tmp;
      v_transactions := v_transactions || coalesce(v_tmp, '[]'::jsonb);
    end if;
  end if;

  -- TIP PURCHASES / UNLOCKS: pominięte w SQL bazowym; jeśli masz osobną tabelę zakupów, raport łapie je przez payments/wallet_transactions.

  -- Wallet transactions / topups
  if to_regclass('public.wallet_transactions') is not null then
    t_amount := public.betai_first_existing_column('wallet_transactions', array['amount','value','total']);
    t_status := public.betai_first_existing_column('wallet_transactions', array['status','payment_status']);
    t_type := public.betai_first_existing_column('wallet_transactions', array['type','transaction_type','source','kind']);
    t_created := public.betai_first_existing_column('wallet_transactions', array['created_at','updated_at']);
    t_user := public.betai_first_existing_column('wallet_transactions', array['user_id','profile_id']);
    t_email := public.betai_first_existing_column('wallet_transactions', array['user_email','email']);

    if t_amount is not null then
      v_sql := 'select coalesce(sum((' || quote_ident(t_amount) || ')::numeric),0) from public.wallet_transactions where true';
      if t_type is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_type) || '::text, '''')) in (''topup'', ''deposit'', ''wallet_topup'', ''stripe_topup'')';
      end if;
      if t_status is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_status) || '::text, ''completed'')) in (''paid'', ''succeeded'', ''completed'', ''success'')';
      end if;
      execute v_sql into v_wallet_topups;

      v_sql := 'select coalesce(jsonb_agg(jsonb_build_object(' ||
        quote_literal('id') || ', id::text, ' ||
        quote_literal('created_at') || ', ' || coalesce(quote_ident(t_created), 'now()') || ', ' ||
        quote_literal('type') || ', coalesce(' || coalesce(quote_ident(t_type) || '::text', quote_literal('wallet')) || ', ''wallet''), ' ||
        quote_literal('source') || ', ''wallet_transactions'', ' ||
        quote_literal('user_id') || ', ' || coalesce(quote_ident(t_user) || '::text', 'null') || ', ' ||
        quote_literal('user_email') || ', ' || coalesce(quote_ident(t_email) || '::text', 'null') || ', ' ||
        quote_literal('amount') || ', (' || quote_ident(t_amount) || ')::numeric, ' ||
        quote_literal('status') || ', coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('completed')) || ', ''completed'')' ||
        ') order by ' || coalesce(quote_ident(t_created), 'now()') || ' desc), ''[]''::jsonb) from (select * from public.wallet_transactions order by ' || coalesce(quote_ident(t_created), 'id') || ' desc limit 20) wt';
      execute v_sql into v_tmp;
      v_transactions := v_transactions || coalesce(v_tmp, '[]'::jsonb);
    end if;
  end if;

  -- Payout requests
  if to_regclass('public.payout_requests') is not null then
    t_amount := public.betai_first_existing_column('payout_requests', array['amount','payout_amount','value']);
    t_status := public.betai_first_existing_column('payout_requests', array['status','payout_status','stripe_status']);
    t_created := public.betai_first_existing_column('payout_requests', array['created_at','requested_at','updated_at']);
    t_user := public.betai_first_existing_column('payout_requests', array['user_id','tipster_id','profile_id']);
    t_email := public.betai_first_existing_column('payout_requests', array['user_email','email','tipster_email']);

    if t_amount is not null then
      v_sql := 'select coalesce(sum(case when lower(coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('pending')) || ', ''pending'')) in (''paid'', ''approved'', ''completed'', ''succeeded'') then (' || quote_ident(t_amount) || ')::numeric else 0 end),0), ' ||
               'coalesce(sum(case when lower(coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('pending')) || ', ''pending'')) in (''pending'', ''processing'', ''requested'') then (' || quote_ident(t_amount) || ')::numeric else 0 end),0) ' ||
               'from public.payout_requests';
      execute v_sql into v_total_payouts, v_pending_payouts;

      v_sql := 'select coalesce(jsonb_agg(jsonb_build_object(' ||
        quote_literal('id') || ', id::text, ' ||
        quote_literal('created_at') || ', ' || coalesce(quote_ident(t_created), 'now()') || ', ' ||
        quote_literal('type') || ', ''payout'', ' ||
        quote_literal('source') || ', ''payout_requests'', ' ||
        quote_literal('user_id') || ', ' || coalesce(quote_ident(t_user) || '::text', 'null') || ', ' ||
        quote_literal('user_email') || ', ' || coalesce(quote_ident(t_email) || '::text', 'null') || ', ' ||
        quote_literal('amount') || ', (' || quote_ident(t_amount) || ')::numeric, ' ||
        quote_literal('status') || ', coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('pending')) || ', ''pending'')' ||
        ') order by ' || coalesce(quote_ident(t_created), 'now()') || ' desc), ''[]''::jsonb) from (select * from public.payout_requests order by ' || coalesce(quote_ident(t_created), 'id') || ' desc limit 20) pr';
      execute v_sql into v_tmp;
      v_transactions := v_transactions || coalesce(v_tmp, '[]'::jsonb);
    end if;
  end if;

  -- Tipster earnings from existing table if present
  if to_regclass('public.tipster_earnings') is not null then
    t_amount := public.betai_first_existing_column('tipster_earnings', array['amount','earning','tipster_amount','net_amount']);
    t_status := public.betai_first_existing_column('tipster_earnings', array['status','earning_status']);
    if t_amount is not null then
      v_sql := 'select coalesce(sum((' || quote_ident(t_amount) || ')::numeric),0) from public.tipster_earnings where true';
      if t_status is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_status) || '::text, ''completed'')) not in (''cancelled'', ''rejected'', ''failed'')';
      end if;
      execute v_sql into v_tipster_earnings;
    end if;
  end if;

  -- Marketplace split fallback: jeśli mamy gross, licz 80/20.
  if v_gross_sales > 0 then
    if v_tipster_earnings = 0 then
      v_tipster_earnings := round(v_gross_sales * 0.80, 2);
    end if;
    v_platform_commission := round(v_gross_sales * 0.20, 2);
  end if;

  v_available_to_payout := greatest(0, coalesce(v_tipster_earnings,0) - coalesce(v_total_payouts,0) - coalesce(v_pending_payouts,0));
  v_total_platform_revenue := coalesce(v_premium_revenue,0) + coalesce(v_platform_commission,0);

  return jsonb_build_object(
    'ok', true,
    'source', 'get_admin_finance_report_v1042',
    'generated_at', now(),
    'platform_commission', coalesce(v_platform_commission,0),
    'premium_revenue', coalesce(v_premium_revenue,0),
    'total_platform_revenue', coalesce(v_total_platform_revenue,0),
    'total_sales', coalesce(v_total_sales,0),
    'gross_sales', coalesce(v_gross_sales,0),
    'tipster_earnings', coalesce(v_tipster_earnings,0),
    'total_payouts', coalesce(v_total_payouts,0),
    'pending_payouts', coalesce(v_pending_payouts,0),
    'available_to_payout', coalesce(v_available_to_payout,0),
    'wallet_topups', coalesce(v_wallet_topups,0),
    'active_premium_users', coalesce(v_active_premium_users,0),
    'transactions', (
      select coalesce(jsonb_agg(x order by (x->>'created_at')::timestamptz desc), '[]'::jsonb)
      from (
        select value as x
        from jsonb_array_elements(v_transactions)
        limit 60
      ) rows
    )
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', sqlerrm,
      'source', 'get_admin_finance_report_v1042',
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
end;
$$;

revoke all on function public.get_admin_finance_report() from public;
grant execute on function public.get_admin_finance_report() to authenticated;

select 'v1042 admin finance real report and guard ready' as status;
