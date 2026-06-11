
-- supabase/version_1046_admin_finance_no_recursion_usernames.sql
-- Naprawa po 1045:
-- - usuwa pętlę/recursion "stack depth limit exceeded",
-- - get_admin_finance_report() jest pełną funkcją, NIE wrapperem,
-- - transakcje mają display_user/user_username/raw_user_id z profiles,
-- - przywraca ostatnie operacje finansowe.

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

create or replace function public.betai_safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or trim(p_value) = '' then
    return null;
  end if;

  return p_value::uuid;
exception
  when others then
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

create or replace function public.betai_finance_user_identity(
  p_user_id text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uuid uuid := public.betai_safe_uuid(p_user_id);
  v_username text;
  v_display_name text;
  v_full_name text;
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_sql text;
  v_result jsonb;
begin
  if to_regclass('public.profiles') is not null and v_uuid is not null then
    v_sql := 'select jsonb_build_object(' ||
      quote_literal('username') || ', ' ||
        case when public.betai_column_exists('profiles','username') then 'username' else 'null::text' end || ', ' ||
      quote_literal('display_name') || ', ' ||
        case when public.betai_column_exists('profiles','display_name') then 'display_name' else 'null::text' end || ', ' ||
      quote_literal('full_name') || ', ' ||
        case when public.betai_column_exists('profiles','full_name') then 'full_name' else 'null::text' end || ', ' ||
      quote_literal('email') || ', ' ||
        case when public.betai_column_exists('profiles','email') then 'email' else quote_literal(v_email) end ||
      ') from public.profiles where id = $1 limit 1';

    execute v_sql using v_uuid into v_result;

    if v_result is not null then
      v_username := nullif(v_result->>'username', '');
      v_display_name := nullif(v_result->>'display_name', '');
      v_full_name := nullif(v_result->>'full_name', '');
      v_email := coalesce(nullif(v_result->>'email', ''), v_email);
    end if;
  end if;

  return jsonb_build_object(
    'user_username', v_username,
    'user_display_name', v_display_name,
    'user_full_name', v_full_name,
    'user_email_resolved', v_email,
    'display_user', coalesce(v_username, v_display_name, v_full_name, v_email, p_user_id, '—'),
    'raw_user_id', p_user_id
  );
end;
$$;

create or replace function public.betai_admin_finance_enrich_transactions(
  p_transactions jsonb
)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      value
      || public.betai_finance_user_identity(value->>'user_id', value->>'user_email')
      order by coalesce((value->>'created_at')::timestamptz, now()) desc
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb));
$$;

-- Usuwamy wadliwy raw-wrapper z 1045, jeżeli istnieje.
drop function if exists public.get_admin_finance_report_raw_v1045();

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

  -- Aktywne konta premium z profiles
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

  -- Payments: premium + marketplace
  if to_regclass('public.payments') is not null then
    t_amount := public.betai_first_existing_column('payments', array[
      'amount','price','total','total_amount','gross_amount','payment_amount'
    ]);
    t_status := public.betai_first_existing_column('payments', array[
      'status','payment_status','stripe_status'
    ]);
    t_type := public.betai_first_existing_column('payments', array[
      'type','payment_type','source','kind','product_type'
    ]);
    t_created := public.betai_first_existing_column('payments', array[
      'created_at','paid_at','updated_at'
    ]);
    t_user := public.betai_first_existing_column('payments', array[
      'user_id','buyer_id','payer_id','profile_id'
    ]);
    t_email := public.betai_first_existing_column('payments', array[
      'user_email','email','buyer_email','customer_email'
    ]);

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
        v_sql := v_sql || ' and (
          lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%tip%''
          or lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%market%''
          or lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%single%''
          or lower(coalesce(' || quote_ident(t_type) || '::text, '''')) like ''%subscription%''
        )';
      else
        v_sql := v_sql || ' and false';
      end if;

      execute v_sql into v_gross_sales, v_total_sales;

      -- Payments transactions
      v_sql := 'select coalesce(jsonb_agg(jsonb_build_object(
          ''id'', id::text,
          ''created_at'', ' || coalesce(quote_ident(t_created), 'now()') || ',
          ''type'', coalesce(' || coalesce(quote_ident(t_type) || '::text', quote_literal('payment')) || ', ''payment''),
          ''source'', ''payments'',
          ''user_id'', ' || coalesce(quote_ident(t_user) || '::text', 'null') || ',
          ''user_email'', ' || coalesce(quote_ident(t_email) || '::text', 'null') || ',
          ''amount'', (' || quote_ident(t_amount) || ')::numeric,
          ''status'', coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('completed')) || ', ''completed'')
        ) order by ' || coalesce(quote_ident(t_created), 'now()') || ' desc), ''[]''::jsonb)
        from (
          select *
          from public.payments
          order by ' || coalesce(quote_ident(t_created), 'id') || ' desc
          limit 40
        ) p';

      execute v_sql into v_tmp;
      v_transactions := v_transactions || coalesce(v_tmp, '[]'::jsonb);
    end if;
  end if;

  -- Wallet transactions / topups
  if to_regclass('public.wallet_transactions') is not null then
    t_amount := public.betai_first_existing_column('wallet_transactions', array[
      'amount','value','total'
    ]);
    t_status := public.betai_first_existing_column('wallet_transactions', array[
      'status','payment_status'
    ]);
    t_type := public.betai_first_existing_column('wallet_transactions', array[
      'type','transaction_type','source','kind'
    ]);
    t_created := public.betai_first_existing_column('wallet_transactions', array[
      'created_at','updated_at'
    ]);
    t_user := public.betai_first_existing_column('wallet_transactions', array[
      'user_id','profile_id'
    ]);
    t_email := public.betai_first_existing_column('wallet_transactions', array[
      'user_email','email'
    ]);

    if t_amount is not null then
      v_sql := 'select coalesce(sum((' || quote_ident(t_amount) || ')::numeric),0) from public.wallet_transactions where true';

      if t_type is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_type) || '::text, '''')) in (''topup'', ''deposit'', ''wallet_topup'', ''stripe_topup'')';
      end if;

      if t_status is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_status) || '::text, ''completed'')) in (''paid'', ''succeeded'', ''completed'', ''success'')';
      end if;

      execute v_sql into v_wallet_topups;

      v_sql := 'select coalesce(jsonb_agg(jsonb_build_object(
          ''id'', id::text,
          ''created_at'', ' || coalesce(quote_ident(t_created), 'now()') || ',
          ''type'', coalesce(' || coalesce(quote_ident(t_type) || '::text', quote_literal('wallet')) || ', ''wallet''),
          ''source'', ''wallet_transactions'',
          ''user_id'', ' || coalesce(quote_ident(t_user) || '::text', 'null') || ',
          ''user_email'', ' || coalesce(quote_ident(t_email) || '::text', 'null') || ',
          ''amount'', (' || quote_ident(t_amount) || ')::numeric,
          ''status'', coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('completed')) || ', ''completed'')
        ) order by ' || coalesce(quote_ident(t_created), 'now()') || ' desc), ''[]''::jsonb)
        from (
          select *
          from public.wallet_transactions
          order by ' || coalesce(quote_ident(t_created), 'id') || ' desc
          limit 40
        ) wt';

      execute v_sql into v_tmp;
      v_transactions := v_transactions || coalesce(v_tmp, '[]'::jsonb);
    end if;
  end if;

  -- Payout requests
  if to_regclass('public.payout_requests') is not null then
    t_amount := public.betai_first_existing_column('payout_requests', array[
      'amount','payout_amount','value'
    ]);
    t_status := public.betai_first_existing_column('payout_requests', array[
      'status','payout_status','stripe_status'
    ]);
    t_created := public.betai_first_existing_column('payout_requests', array[
      'created_at','requested_at','updated_at'
    ]);
    t_user := public.betai_first_existing_column('payout_requests', array[
      'user_id','tipster_id','profile_id'
    ]);
    t_email := public.betai_first_existing_column('payout_requests', array[
      'user_email','email','tipster_email'
    ]);

    if t_amount is not null then
      v_sql := 'select
          coalesce(sum(case
            when lower(coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('pending')) || ', ''pending'')) in (''paid'', ''approved'', ''completed'', ''succeeded'')
            then (' || quote_ident(t_amount) || ')::numeric
            else 0
          end),0),
          coalesce(sum(case
            when lower(coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('pending')) || ', ''pending'')) in (''pending'', ''processing'', ''requested'')
            then (' || quote_ident(t_amount) || ')::numeric
            else 0
          end),0)
        from public.payout_requests';

      execute v_sql into v_total_payouts, v_pending_payouts;

      v_sql := 'select coalesce(jsonb_agg(jsonb_build_object(
          ''id'', id::text,
          ''created_at'', ' || coalesce(quote_ident(t_created), 'now()') || ',
          ''type'', ''payout'',
          ''source'', ''payout_requests'',
          ''user_id'', ' || coalesce(quote_ident(t_user) || '::text', 'null') || ',
          ''user_email'', ' || coalesce(quote_ident(t_email) || '::text', 'null') || ',
          ''amount'', (' || quote_ident(t_amount) || ')::numeric,
          ''status'', coalesce(' || coalesce(quote_ident(t_status) || '::text', quote_literal('pending')) || ', ''pending'')
        ) order by ' || coalesce(quote_ident(t_created), 'now()') || ' desc), ''[]''::jsonb)
        from (
          select *
          from public.payout_requests
          order by ' || coalesce(quote_ident(t_created), 'id') || ' desc
          limit 40
        ) pr';

      execute v_sql into v_tmp;
      v_transactions := v_transactions || coalesce(v_tmp, '[]'::jsonb);
    end if;
  end if;

  -- Tipster earnings from existing table if present
  if to_regclass('public.tipster_earnings') is not null then
    t_amount := public.betai_first_existing_column('tipster_earnings', array[
      'amount','earning','tipster_amount','net_amount'
    ]);
    t_status := public.betai_first_existing_column('tipster_earnings', array[
      'status','earning_status'
    ]);

    if t_amount is not null then
      v_sql := 'select coalesce(sum((' || quote_ident(t_amount) || ')::numeric),0) from public.tipster_earnings where true';

      if t_status is not null then
        v_sql := v_sql || ' and lower(coalesce(' || quote_ident(t_status) || '::text, ''completed'')) not in (''cancelled'', ''rejected'', ''failed'')';
      end if;

      execute v_sql into v_tipster_earnings;
    end if;
  end if;

  -- Marketplace split fallback 80/20
  if v_gross_sales > 0 then
    if v_tipster_earnings = 0 then
      v_tipster_earnings := round(v_gross_sales * 0.80, 2);
    end if;

    v_platform_commission := round(v_gross_sales * 0.20, 2);
  end if;

  v_available_to_payout := greatest(
    0,
    coalesce(v_tipster_earnings,0) - coalesce(v_total_payouts,0) - coalesce(v_pending_payouts,0)
  );

  v_total_platform_revenue := coalesce(v_premium_revenue,0) + coalesce(v_platform_commission,0);

  return jsonb_build_object(
    'ok', true,
    'source', 'get_admin_finance_report_v1046_no_recursion_usernames',
    'generated_at', now(),
    'usernames_enriched', true,
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
    'transactions', public.betai_admin_finance_enrich_transactions(v_transactions)
  );

exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', sqlerrm,
      'source', 'get_admin_finance_report_v1046_no_recursion_usernames',
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
grant execute on function public.betai_safe_uuid(text) to authenticated;
grant execute on function public.betai_finance_user_identity(text, text) to authenticated;
grant execute on function public.betai_admin_finance_enrich_transactions(jsonb) to authenticated;

select 'v1046 admin finance no recursion usernames ready' as status;
