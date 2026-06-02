-- WERSJA 1540 — BetAI Misje i nagrody: tygodniowa obecność + coiny
-- Zasady:
-- Free: komplet 7/7 dni obecności = 7 coin
-- Premium: komplet 7/7 dni obecności = 14 coin
-- Odbiór nagrody za poprzedni tydzień od poniedziałku po północy.

create extension if not exists pgcrypto;

create table if not exists public.user_weekly_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  week_start date not null,
  day_index int not null check (day_index between 1 and 7),
  visit_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, week_start, day_index)
);

create index if not exists idx_user_weekly_attendance_user_week
  on public.user_weekly_attendance(user_id, week_start);

create table if not exists public.user_weekly_attendance_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  week_start date not null,
  reward_coins int not null check (reward_coins > 0),
  plan_at_claim text not null default 'free',
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);

create index if not exists idx_user_weekly_attendance_rewards_user_week
  on public.user_weekly_attendance_rewards(user_id, week_start);

alter table public.user_weekly_attendance enable row level security;
alter table public.user_weekly_attendance_rewards enable row level security;

drop policy if exists "attendance_owner_select" on public.user_weekly_attendance;
create policy "attendance_owner_select"
  on public.user_weekly_attendance
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "attendance_owner_insert" on public.user_weekly_attendance;
create policy "attendance_owner_insert"
  on public.user_weekly_attendance
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "attendance_reward_owner_select" on public.user_weekly_attendance_rewards;
create policy "attendance_reward_owner_select"
  on public.user_weekly_attendance_rewards
  for select
  to authenticated
  using (user_id = auth.uid());

-- Helper: status premium czytany defensywnie z profiles przez jsonb,
-- żeby SQL nie wywalił się, jeśli projekt ma różne nazwy kolumn.
create or replace function public.get_betai_profile_plan_v1540(p_user_id uuid, p_email text)
returns table(is_premium boolean, plan_label text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_json jsonb := '{}'::jsonb;
  raw_plan text := '';
  raw_status text := '';
begin
  select to_jsonb(p) into profile_json
  from public.profiles p
  where p.id = p_user_id
     or lower(coalesce(p.email, '')) = lower(coalesce(p_email, ''))
  limit 1;

  raw_plan := lower(coalesce(profile_json->>'plan', profile_json->>'premium_status', profile_json->>'role', ''));
  raw_status := lower(coalesce(profile_json->>'subscription_status', profile_json->>'status', ''));

  is_premium := coalesce((profile_json->>'is_premium')::boolean, false)
    or coalesce((profile_json->>'premium')::boolean, false)
    or coalesce((profile_json->>'premium_active')::boolean, false)
    or raw_plan in ('premium','vip','admin','active','trialing','premium_active')
    or raw_status in ('premium','active','trialing','admin')
    or raw_plan like '%premium%'
    or raw_status like '%premium%';

  plan_label := case when is_premium then 'premium' else 'free' end;
  return next;
exception when others then
  is_premium := false;
  plan_label := 'free';
  return next;
end;
$$;

create or replace function public.get_weekly_attendance_status_v1540()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_today date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
  v_prev_week_start date := (date_trunc('week', current_date)::date - interval '7 days')::date;
  v_today_day int := extract(isodow from current_date)::int;
  v_days int[] := array[]::int[];
  v_count int := 0;
  v_prev_count int := 0;
  v_prev_claimed boolean := false;
  v_is_premium boolean := false;
  v_plan text := 'free';
  v_reward int := 7;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select p.is_premium, p.plan_label into v_is_premium, v_plan
  from public.get_betai_profile_plan_v1540(v_user_id, v_email) p
  limit 1;

  v_reward := case when coalesce(v_is_premium, false) then 14 else 7 end;

  select coalesce(array_agg(day_index order by day_index), array[]::int[]), count(*)::int
    into v_days, v_count
  from public.user_weekly_attendance
  where user_id = v_user_id and week_start = v_week_start;

  select count(*)::int into v_prev_count
  from public.user_weekly_attendance
  where user_id = v_user_id and week_start = v_prev_week_start;

  select exists(
    select 1 from public.user_weekly_attendance_rewards
    where user_id = v_user_id and week_start = v_prev_week_start
  ) into v_prev_claimed;

  return jsonb_build_object(
    'current_week_start', v_week_start,
    'previous_week_start', v_prev_week_start,
    'today_day_index', v_today_day,
    'current_week_days', v_days,
    'current_week_count', v_count,
    'previous_week_count', v_prev_count,
    'previous_week_complete', v_prev_count >= 7,
    'previous_week_claimed', v_prev_claimed,
    'can_claim_previous', (v_prev_count >= 7 and not v_prev_claimed),
    'is_premium', coalesce(v_is_premium, false),
    'plan', v_plan,
    'reward_coins', v_reward
  );
end;
$$;

create or replace function public.mark_weekly_attendance_v1540()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_week_start date := date_trunc('week', current_date)::date;
  v_today_day int := extract(isodow from current_date)::int;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  insert into public.user_weekly_attendance(user_id, email, week_start, day_index, visit_date)
  values (v_user_id, v_email, v_week_start, v_today_day, current_date)
  on conflict (user_id, week_start, day_index) do update
    set email = excluded.email,
        visit_date = excluded.visit_date;

  return public.get_weekly_attendance_status_v1540();
end;
$$;

create or replace function public.claim_weekly_attendance_reward_v1540()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_prev_week_start date := (date_trunc('week', current_date)::date - interval '7 days')::date;
  v_prev_count int := 0;
  v_already boolean := false;
  v_is_premium boolean := false;
  v_plan text := 'free';
  v_reward int := 7;
  v_new_balance numeric := 0;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if v_email = '' then
    select lower(coalesce(email, '')) into v_email from auth.users where id = v_user_id limit 1;
  end if;

  select count(*)::int into v_prev_count
  from public.user_weekly_attendance
  where user_id = v_user_id and week_start = v_prev_week_start;

  if v_prev_count < 7 then
    raise exception 'WEEK_NOT_COMPLETE';
  end if;

  select exists(
    select 1 from public.user_weekly_attendance_rewards
    where user_id = v_user_id and week_start = v_prev_week_start
  ) into v_already;

  if v_already then
    raise exception 'REWARD_ALREADY_CLAIMED';
  end if;

  select p.is_premium, p.plan_label into v_is_premium, v_plan
  from public.get_betai_profile_plan_v1540(v_user_id, v_email) p
  limit 1;

  v_reward := case when coalesce(v_is_premium, false) then 14 else 7 end;

  insert into public.user_weekly_attendance_rewards(user_id, email, week_start, reward_coins, plan_at_claim)
  values (v_user_id, v_email, v_prev_week_start, v_reward, v_plan);

  insert into public.betai_token_wallets(email, user_id, balance, updated_at)
  values (v_email, v_user_id, v_reward, now())
  on conflict (email) do update
    set balance = coalesce(public.betai_token_wallets.balance, 0) + excluded.balance,
        user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
        updated_at = now()
  returning balance into v_new_balance;

  insert into public.betai_token_transactions(email, user_id, delta_tokens, delta_pln, reason, ref_type, ref_id, ref_data, created_at)
  values (
    v_email,
    v_user_id,
    v_reward,
    0,
    'weekly_attendance_reward',
    'weekly_attendance',
    v_prev_week_start::text,
    jsonb_build_object('week_start', v_prev_week_start, 'days', v_prev_count, 'plan', v_plan, 'reward_coins', v_reward),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'week_start', v_prev_week_start,
    'reward_coins', v_reward,
    'new_balance', v_new_balance,
    'plan', v_plan
  );
end;
$$;

grant select, insert on public.user_weekly_attendance to authenticated;
grant select on public.user_weekly_attendance_rewards to authenticated;
grant execute on function public.get_betai_profile_plan_v1540(uuid, text) to authenticated;
grant execute on function public.get_weekly_attendance_status_v1540() to authenticated;
grant execute on function public.mark_weekly_attendance_v1540() to authenticated;
grant execute on function public.claim_weekly_attendance_reward_v1540() to authenticated;

notify pgrst, 'reload schema';

select 'WERSJA 1540 weekly attendance coins SQL OK' as status;
