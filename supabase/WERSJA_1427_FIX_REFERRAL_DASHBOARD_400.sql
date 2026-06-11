-- WERSJA 1427 — FIX get_referral_dashboard 400
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Naprawia request:
--   rpc/get_referral_dashboard 400
--
-- Przyczyna zwykle:
-- - stara funkcja miała inny return type,
-- - PostgREST nie znajduje funkcji z argumentem p_user_id,
-- - albo funkcja wywala się przez brak kompatybilnych kolumn.
--
-- Ten SQL tworzy prostą, szybką i kompatybilną funkcję:
-- public.get_referral_dashboard(p_user_id uuid)

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referrals_count integer not null default 0;
alter table public.profiles add column if not exists buyers_count integer not null default 0;
alter table public.profiles add column if not exists referral_reward_total integer not null default 0;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  referrer_code text,
  referred_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  threshold integer not null default 0,
  reward_amount integer not null default 0,
  reward_type text not null default 'coin',
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

create index if not exists referral_rewards_referrer_created_idx
  on public.referral_rewards (referrer_id, created_at desc);

create index if not exists profiles_referral_code_lower_idx
  on public.profiles (lower(referral_code))
  where referral_code is not null and referral_code <> '';

-- Ważne: DROP, bo Postgres nie pozwala zmienić return type przez CREATE OR REPLACE.
drop function if exists public.get_referral_dashboard(uuid);

create function public.get_referral_dashboard(p_user_id uuid)
returns table (
  referral_code text,
  referrals_count integer,
  buyers_count integer,
  reward_total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referrals integer := 0;
  v_rewards integer := 0;
begin
  if p_user_id is null then
    return query select ''::text, 0::integer, 0::integer, 0::integer;
    return;
  end if;

  -- Tylko właściciel albo admin powinien pobierać swój dashboard.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    if not coalesce((select is_admin from public.profiles where id = auth.uid() limit 1), false) then
      raise exception 'not allowed';
    end if;
  end if;

  select coalesce(p.referral_code, '')
    into v_code
  from public.profiles p
  where p.id = p_user_id
  limit 1;

  if v_code is null or trim(v_code) = '' then
    v_code := upper(substr(replace(p_user_id::text, '-', ''), 1, 10));

    update public.profiles
    set referral_code = v_code
    where id = p_user_id
      and (referral_code is null or referral_code = '');
  end if;

  select count(*)::integer
    into v_referrals
  from public.referrals r
  where r.referrer_id = p_user_id;

  select coalesce(sum(rr.reward_amount), 0)::integer
    into v_rewards
  from public.referral_rewards rr
  where rr.referrer_id = p_user_id;

  update public.profiles
  set
    referrals_count = coalesce(v_referrals, 0),
    buyers_count = coalesce(v_referrals, 0),
    referral_reward_total = coalesce(v_rewards, 0)
  where id = p_user_id;

  return query
  select
    coalesce(v_code, '')::text,
    coalesce(v_referrals, 0)::integer,
    coalesce(v_referrals, 0)::integer,
    coalesce(v_rewards, 0)::integer;
end;
$$;

grant execute on function public.get_referral_dashboard(uuid) to authenticated;

select 'WERSJA 1427 get_referral_dashboard 400 fixed' as status;
