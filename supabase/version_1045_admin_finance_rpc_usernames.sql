
-- supabase/version_1045_admin_finance_rpc_usernames.sql
-- Fix do Admin finanse:
-- nick/display_user jest doklejany po stronie RPC security definer,
-- więc tabela nie pokazuje już samego UUID.

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

create or replace function public.betai_finance_user_identity(p_user_id text, p_email text default null)
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

create or replace function public.betai_admin_finance_enrich_transactions(p_transactions jsonb)
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

-- Nadpisujemy tylko końcówkę raportu bez przebudowy całej logiki:
-- wrapper bierze obecny raport i dokleja display_user do transactions.
-- Najpierw zachowujemy starą funkcję pod nazwą _raw, jeśli jeszcze jej nie ma.

do $$
begin
  if to_regprocedure('public.get_admin_finance_report_raw_v1045()') is null then
    execute 'create function public.get_admin_finance_report_raw_v1045() returns jsonb language sql security definer set search_path = public, auth as $fn$ select public.get_admin_finance_report() $fn$';
  end if;
exception
  when duplicate_function then null;
end $$;

create or replace function public.get_admin_finance_report()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_report jsonb;
  v_transactions jsonb;
begin
  -- Jeśli jest pełna funkcja z 1042, raw wrapper ją odpala.
  -- Następnie dokładamy nazwy użytkowników do każdej transakcji.
  v_report := public.get_admin_finance_report_raw_v1045();

  if coalesce((v_report->>'ok')::boolean, false) = false then
    return v_report;
  end if;

  v_transactions := public.betai_admin_finance_enrich_transactions(v_report->'transactions');

  return v_report
    || jsonb_build_object(
      'transactions', v_transactions,
      'source', 'get_admin_finance_report_v1045_usernames',
      'usernames_enriched', true
    );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', sqlerrm,
      'source', 'get_admin_finance_report_v1045_usernames',
      'transactions', '[]'::jsonb
    );
end;
$$;

grant execute on function public.betai_safe_uuid(text) to authenticated;
grant execute on function public.betai_finance_user_identity(text, text) to authenticated;
grant execute on function public.betai_admin_finance_enrich_transactions(jsonb) to authenticated;
grant execute on function public.get_admin_finance_report() to authenticated;

select 'v1045 admin finance rpc usernames ready' as status;
