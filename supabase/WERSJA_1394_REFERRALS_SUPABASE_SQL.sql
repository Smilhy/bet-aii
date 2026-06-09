-- WERSJA 1394 — Bet+AI referral system / Polecenia
-- Wklej całość w Supabase SQL Editor i uruchom.
-- Cel:
-- 1) każdy użytkownik ma referral_code,
-- 2) rejestracja z linku ?ref=KOD zapisuje rekord w public.referrals,
-- 3) licznik poleconych działa w Rankingu i w Mój profil,
-- 4) progi wypłacają Coin do betai_token_wallets:
--    10 poleceń = +10 coin
--    50 poleceń = +100 coin
--    150 poleceń = +1000 coin
--    300 poleceń = +10000 coin

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists referral_code text;

alter table public.profiles
  add column if not exists referrals_count integer not null default 0;

alter table public.profiles
  add column if not exists buyers_count integer not null default 0;

alter table public.profiles
  add column if not exists referral_reward_total integer not null default 0;

create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (lower(referral_code))
  where referral_code is not null and referral_code <> '';

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  referrer_code text not null,
  referred_email text,
  created_at timestamptz not null default now(),
  unique (referred_id)
);

create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
create index if not exists referrals_created_at_idx on public.referrals(created_at desc);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  threshold_count integer not null,
  reward_coins integer not null,
  currency text not null default 'coin',
  created_at timestamptz not null default now(),
  unique (referrer_id, threshold_count)
);

create index if not exists referral_rewards_referrer_id_idx on public.referral_rewards(referrer_id);

create or replace function public.betai_normalize_referral_code(value text)
returns text
language sql
immutable
as $$
  select upper(left(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '', 'g'), 32));
$$;

create or replace function public.ensure_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_code text;
  final_code text;
  suffix int := 0;
  existing_code text;
  profile_row public.profiles%rowtype;
begin
  select * into profile_row
  from public.profiles
  where id = p_user_id
  limit 1;

  if not found then
    return '';
  end if;

  existing_code := public.betai_normalize_referral_code(profile_row.referral_code);
  if existing_code <> '' then
    update public.profiles
      set referral_code = existing_code
      where id = p_user_id and referral_code is distinct from existing_code;
    return existing_code;
  end if;

  base_code := public.betai_normalize_referral_code(
    coalesce(profile_row.username, split_part(profile_row.email, '@', 1), left(p_user_id::text, 8))
  );

  if base_code = '' then
    base_code := upper(left(replace(p_user_id::text, '-', ''), 8));
  end if;

  final_code := left(base_code, 20);

  while exists (
    select 1
    from public.profiles
    where lower(referral_code) = lower(final_code)
      and id <> p_user_id
  ) loop
    suffix := suffix + 1;
    final_code := left(base_code, 18) || suffix::text;
  end loop;

  update public.profiles
    set referral_code = final_code
    where id = p_user_id;

  return final_code;
end;
$$;

create or replace function public.betai_award_referral_rewards(p_referrer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_count int;
  ref_email text;
  threshold_row record;
begin
  select count(*) into ref_count
  from public.referrals
  where referrer_id = p_referrer_id;

  select email into ref_email
  from public.profiles
  where id = p_referrer_id;

  for threshold_row in
    select * from (values
      (10, 10),
      (50, 100),
      (150, 1000),
      (300, 10000)
    ) as t(threshold_count, reward_coins)
  loop
    if ref_count >= threshold_row.threshold_count then
      insert into public.referral_rewards(referrer_id, threshold_count, reward_coins, currency)
      values (p_referrer_id, threshold_row.threshold_count, threshold_row.reward_coins, 'coin')
      on conflict (referrer_id, threshold_count) do nothing;

      if found and coalesce(ref_email, '') <> '' then
        insert into public.betai_token_wallets(email, user_id, balance, welcome_bonus_claimed, updated_at)
        values (lower(ref_email), p_referrer_id, threshold_row.reward_coins, true, now())
        on conflict (email)
        do update set
          balance = coalesce(public.betai_token_wallets.balance, 0) + excluded.balance,
          user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
          updated_at = now();

        insert into public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_data)
        values (
          lower(ref_email),
          threshold_row.reward_coins,
          'referral_reward',
          'referral_rewards',
          jsonb_build_object(
            'threshold', threshold_row.threshold_count,
            'reward_coins', threshold_row.reward_coins,
            'referrals_count', ref_count
          )
        );

        insert into public.betai_system_notifications(recipient_email, title, body, reward_tokens, sent_by, is_read)
        values (
          lower(ref_email),
          'Nagroda za polecenia',
          'Gratulacje! Osiągnąłeś próg ' || threshold_row.threshold_count || ' poleceń i otrzymujesz +' || threshold_row.reward_coins || ' coin.',
          threshold_row.reward_coins,
          'betai',
          false
        );
      end if;
    end if;
  end loop;

  update public.profiles
    set referrals_count = ref_count,
        buyers_count = ref_count,
        referral_reward_total = coalesce((select sum(reward_coins) from public.referral_rewards where referrer_id = p_referrer_id), 0)
    where id = p_referrer_id;
end;
$$;

create or replace function public.register_referral_signup(
  p_referred_id uuid,
  p_referral_code text,
  p_referred_email text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text;
  referrer_profile public.profiles%rowtype;
  inserted_id uuid;
begin
  clean_code := public.betai_normalize_referral_code(p_referral_code);

  if p_referred_id is null or clean_code = '' then
    return false;
  end if;

  select * into referrer_profile
  from public.profiles
  where lower(referral_code) = lower(clean_code)
  limit 1;

  if not found then
    return false;
  end if;

  if referrer_profile.id = p_referred_id then
    return false;
  end if;

  insert into public.referrals(referrer_id, referred_id, referrer_code, referred_email)
  values (referrer_profile.id, p_referred_id, clean_code, lower(coalesce(p_referred_email, '')))
  on conflict (referred_id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return false;
  end if;

  perform public.betai_award_referral_rewards(referrer_profile.id);

  return true;
end;
$$;

create or replace function public.get_referral_dashboard(p_user_id uuid)
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
  code text;
  cnt int;
  rewards int;
begin
  code := public.ensure_referral_code(p_user_id);

  select count(*) into cnt
  from public.referrals
  where referrer_id = p_user_id;

  select coalesce(sum(reward_coins), 0) into rewards
  from public.referral_rewards
  where referrer_id = p_user_id;

  update public.profiles
    set referrals_count = cnt,
        buyers_count = cnt,
        referral_reward_total = rewards
    where id = p_user_id;

  return query select code, cnt, cnt, rewards;
end;
$$;

create or replace function public.betai_handle_new_user_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  -- Jeżeli frontend przekaże referral_code w auth metadata przy rejestracji,
  -- trigger zapisze polecenie od razu po utworzeniu auth.users.
  code := public.betai_normalize_referral_code(new.raw_user_meta_data->>'referral_code');

  if code <> '' then
    perform public.register_referral_signup(new.id, code, new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists betai_auth_referral_after_signup on auth.users;

create trigger betai_auth_referral_after_signup
after insert on auth.users
for each row
execute function public.betai_handle_new_user_referral();

alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own"
on public.referrals
for select
using (auth.uid() = referrer_id or auth.uid() = referred_id);

drop policy if exists "referral_rewards_select_own" on public.referral_rewards;
create policy "referral_rewards_select_own"
on public.referral_rewards
for select
using (auth.uid() = referrer_id);

grant execute on function public.ensure_referral_code(uuid) to authenticated;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
grant execute on function public.register_referral_signup(uuid, text, text) to authenticated;
grant select on public.referrals to authenticated;
grant select on public.referral_rewards to authenticated;
