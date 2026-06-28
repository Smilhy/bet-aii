
-- supabase/version_1048_admin_payouts_rpc_usernames.sql
-- Admin Wypłaty: nicki zamiast UUID z backendu RPC.
-- RPC szuka użytkownika w profiles, potem w auth.users, potem fallback UUID.

create extension if not exists pgcrypto;

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

create or replace function public.betai_payout_display_identity(
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
  v_meta jsonb;
  v_sql text;
  v_result jsonb;
begin
  -- 1) profiles
  if to_regclass('public.profiles') is not null and v_uuid is not null then
    v_sql := 'select jsonb_build_object(' ||
      quote_literal('username') || ', ' ||
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
        ) then 'username' else 'null::text' end || ', ' ||
      quote_literal('display_name') || ', ' ||
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
        ) then 'display_name' else 'null::text' end || ', ' ||
      quote_literal('full_name') || ', ' ||
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
        ) then 'full_name' else 'null::text' end || ', ' ||
      quote_literal('email') || ', ' ||
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
        ) then 'email' else quote_literal(v_email) end ||
      ') from public.profiles where id = $1 limit 1';

    execute v_sql using v_uuid into v_result;

    if v_result is not null then
      v_username := nullif(v_result->>'username', '');
      v_display_name := nullif(v_result->>'display_name', '');
      v_full_name := nullif(v_result->>'full_name', '');
      v_email := coalesce(nullif(v_result->>'email', ''), v_email);
    end if;
  end if;

  -- 2) auth.users fallback
  if v_uuid is not null and (v_username is null and v_display_name is null and v_full_name is null and v_email is null) then
    begin
      select
        nullif(raw_user_meta_data->>'username', ''),
        coalesce(
          nullif(raw_user_meta_data->>'display_name', ''),
          nullif(raw_user_meta_data->>'name', '')
        ),
        nullif(raw_user_meta_data->>'full_name', ''),
        nullif(email, ''),
        raw_user_meta_data
      into v_username, v_display_name, v_full_name, v_email, v_meta
      from auth.users
      where id = v_uuid
      limit 1;
    exception
      when others then
        null;
    end;
  end if;

  -- 3) email jako login bez domeny, jeśli nic nie ma
  if v_username is null and v_display_name is null and v_full_name is null and v_email is not null then
    v_username := split_part(v_email, '@', 1);
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

create or replace function public.get_admin_payout_requests()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_admin boolean := false;
  v_rows jsonb := '[]'::jsonb;
begin
  -- admin guard: użyj istniejącej funkcji z 1043/1042
  if to_regprocedure('public.betai_payout_is_admin()') is not null then
    execute 'select public.betai_payout_is_admin()' into v_is_admin;
  elsif to_regprocedure('public.betai_admin_finance_is_admin()') is not null then
    execute 'select public.betai_admin_finance_is_admin()' into v_is_admin;
  end if;

  if not coalesce(v_is_admin,false) then
    return '[]'::jsonb;
  end if;

  if to_regclass('public.payout_requests') is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(pr)
      || public.betai_payout_display_identity(pr.user_id::text, null)
      order by coalesce(pr.created_at, pr.requested_at, now()) desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.payout_requests pr;

  return v_rows;
end;
$$;

grant execute on function public.betai_safe_uuid(text) to authenticated;
grant execute on function public.betai_payout_display_identity(text, text) to authenticated;
grant execute on function public.get_admin_payout_requests() to authenticated;

select 'v1048 admin payouts rpc usernames ready' as status;
