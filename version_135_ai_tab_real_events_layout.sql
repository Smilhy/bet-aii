-- =========================
-- VERSION 129 — REFERRAL SYSTEM
-- Growth + money tracking for Bet+AI
-- =========================

alter table if exists public.profiles
add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_unique
on public.profiles(referral_code)
where referral_code is not null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  status text default 'registered',
  first_purchase_at timestamptz,
  created_at timestamptz default now(),
  unique(referred_user_id)
);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_id text,
  gross_amount numeric default 0,
  reward_amount numeric default 0,
  reward_rate numeric default 0.10,
  stripe_session_id text,
  status text default 'available',
  created_at timestamptz default now()
);

create unique index if not exists referral_rewards_stripe_session_source_unique
on public.referral_rewards(stripe_session_id, source)
where stripe_session_id is not null;

create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
create index if not exists referrals_referred_idx on public.referrals(referred_user_id);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards(referrer_id);

create or replace function public.ensure_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists text;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select referral_code into v_exists
  from public.profiles
  where id = p_user_id;

  if v_exists is not null and length(v_exists) > 0 then
    return v_exists;
  end if;

  v_code := lower(substr(md5(p_user_id::text), 1, 8));

  update public.profiles
  set referral_code = v_code
  where id = p_user_id;

  return v_code;
end;
$$;

create or replace function public.register_referral(p_referred_user_id uuid, p_referral_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  if p_referred_user_id is null or p_referral_code is null or length(trim(p_referral_code)) = 0 then
    return;
  end if;

  select id into v_referrer
  from public.profiles
  where lower(referral_code) = lower(trim(p_referral_code))
  limit 1;

  if v_referrer is null or v_referrer = p_referred_user_id then
    return;
  end if;

  insert into public.referrals (referrer_id, referred_user_id, referral_code, status)
  values (v_referrer, p_referred_user_id, lower(trim(p_referral_code)), 'registered')
  on conflict (referred_user_id) do nothing;
end;
$$;

create or replace function public.record_referral_reward(
  p_referred_user_id uuid,
  p_gross_amount numeric,
  p_source text,
  p_source_id text default null,
  p_stripe_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_reward numeric;
begin
  if p_referred_user_id is null or coalesce(p_gross_amount, 0) <= 0 then
    return;
  end if;

  select referrer_id into v_referrer
  from public.referrals
  where referred_user_id = p_referred_user_id
  limit 1;

  if v_referrer is null or v_referrer = p_referred_user_id then
    return;
  end if;

  v_reward := round((p_gross_amount * 0.10)::numeric, 2);

  insert into public.referral_rewards (
    referrer_id,
    referred_user_id,
    source,
    source_id,
    gross_amount,
    reward_amount,
    reward_rate,
    stripe_session_id,
    status
  ) values (
    v_referrer,
    p_referred_user_id,
    coalesce(p_source, 'purchase'),
    p_source_id,
    p_gross_amount,
    v_reward,
    0.10,
    p_stripe_session_id,
    'available'
  ) on conflict do nothing;

  update public.referrals
  set status = 'buyer',
      first_purchase_at = coalesce(first_purchase_at, now())
  where referred_user_id = p_referred_user_id;
end;
$$;

create or replace function public.get_referral_dashboard(p_user_id uuid)
returns table (
  referral_code text,
  referrals_count bigint,
  buyers_count bigint,
  reward_total numeric
)
language sql
security definer
set search_path = public
as $$
  select
    public.ensure_referral_code(p_user_id) as referral_code,
    (select count(*) from public.referrals r where r.referrer_id = p_user_id) as referrals_count,
    (select count(*) from public.referrals r where r.referrer_id = p_user_id and r.first_purchase_at is not null) as buyers_count,
    coalesce((select sum(rr.reward_amount) from public.referral_rewards rr where rr.referrer_id = p_user_id), 0) as reward_total;
$$;

alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
drop policy if exists "referral_rewards_select_own" on public.referral_rewards;

create policy "referrals_select_own"
on public.referrals
for select
using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

create policy "referral_rewards_select_own"
on public.referral_rewards
for select
using (auth.uid() = referrer_id);
