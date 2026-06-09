-- BET+AI — FIX REJESTRACJI Z LINKU POLECAJĄCEGO
-- Wklej całość w Supabase -> SQL Editor -> Run.
-- Naprawia błąd: "Database error saving new user" przy rejestracji z ?ref=KOD.
-- Przyczyna: trigger poleceń odpalał się przy tworzeniu auth.users, zanim profil nowego użytkownika istniał w public.profiles.

begin;

create extension if not exists pgcrypto;

-- 1) Profiles — upewniamy się, że tabela/kolumny istnieją.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists wallet numeric(10,2) default 0;
alter table public.profiles add column if not exists plan text default 'free';
alter table public.profiles add column if not exists subscription_status text default 'free';
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referrals_count integer not null default 0;
alter table public.profiles add column if not exists buyers_count integer not null default 0;
alter table public.profiles add column if not exists referral_reward_total integer not null default 0;

create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (lower(referral_code))
  where referral_code is not null and referral_code <> '';

-- 2) Tabele poleceń.
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

-- 3) Wallet / transakcje / notyfikacje — bezpieczne minimum.
create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid null,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric not null default 0,
  reason text,
  ref_type text,
  ref_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null,
  body text,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4) Normalizacja kodu.
create or replace function public.betai_normalize_referral_code(value text)
returns text
language sql
immutable
as $$
  select upper(left(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '', 'g'), 32));
$$;

-- 5) Tworzenie/uzupełnianie profilu.
create or replace function public.betai_upsert_profile_for_user(
  p_user_id uuid,
  p_email text,
  p_username text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_slug text;
begin
  if p_user_id is null then
    return;
  end if;

  v_username := coalesce(
    nullif(p_username, ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'user'
  );

  v_slug := lower(regexp_replace(v_username, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := replace(p_user_id::text, '-', '');
  end if;

  insert into public.profiles (
    id, email, username, public_slug, role, wallet, plan, subscription_status,
    is_admin, is_premium, created_at, updated_at
  )
  values (
    p_user_id,
    lower(coalesce(p_email, '')),
    v_username,
    v_slug,
    'user',
    0,
    case when lower(coalesce(p_email, '')) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then 'premium' else 'free' end,
    case when lower(coalesce(p_email, '')) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then 'active' else 'free' end,
    case when lower(coalesce(p_email, '')) = 'smilhytv@gmail.com' then true else false end,
    case when lower(coalesce(p_email, '')) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then true else false end,
    now(),
    now()
  )
  on conflict (id) do update set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    username = coalesce(nullif(public.profiles.username, ''), excluded.username),
    public_slug = coalesce(nullif(public.profiles.public_slug, ''), excluded.public_slug),
    updated_at = now();
end;
$$;

-- 6) Kod polecający użytkownika.
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
  auth_email text;
  auth_username text;
begin
  select email, raw_user_meta_data->>'username'
  into auth_email, auth_username
  from auth.users
  where id = p_user_id;

  perform public.betai_upsert_profile_for_user(p_user_id, auth_email, auth_username);

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
    select 1 from public.profiles
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

-- 7) Nagrody za progi.
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
  reward_inserted boolean;
begin
  select count(*) into ref_count
  from public.referrals
  where referrer_id = p_referrer_id;

  select lower(email) into ref_email
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
      reward_inserted := false;

      insert into public.referral_rewards(referrer_id, threshold_count, reward_coins, currency)
      values (p_referrer_id, threshold_row.threshold_count, threshold_row.reward_coins, 'coin')
      on conflict (referrer_id, threshold_count) do nothing;

      get diagnostics reward_inserted = row_count;

      if reward_inserted and coalesce(ref_email, '') <> '' then
        insert into public.betai_token_wallets(email, user_id, balance, welcome_bonus_claimed, updated_at)
        values (ref_email, p_referrer_id, threshold_row.reward_coins, true, now())
        on conflict (email)
        do update set
          balance = coalesce(public.betai_token_wallets.balance, 0) + excluded.balance,
          user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
          updated_at = now();

        insert into public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_id)
        values (
          ref_email,
          threshold_row.reward_coins,
          0,
          'referral_reward',
          'referral_rewards',
          threshold_row.threshold_count::text
        );

        insert into public.betai_system_notifications(recipient_email, title, body, message, is_read)
        values (
          ref_email,
          'Nagroda za polecenia',
          'Gratulacje! Osiągnąłeś próg ' || threshold_row.threshold_count || ' poleceń i otrzymujesz +' || threshold_row.reward_coins || ' coin.',
          'Gratulacje! Osiągnąłeś próg ' || threshold_row.threshold_count || ' poleceń i otrzymujesz +' || threshold_row.reward_coins || ' coin.',
          false
        );
      end if;
    end if;
  end loop;

  update public.profiles
    set referrals_count = ref_count,
        buyers_count = ref_count,
        referral_reward_total = coalesce((select sum(reward_coins) from public.referral_rewards where referrer_id = p_referrer_id), 0),
        updated_at = now()
    where id = p_referrer_id;
end;
$$;

-- 8) Rejestracja polecenia — ważne: najpierw tworzy profil poleconego, więc nie ma FK error.
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
  auth_email text;
  auth_username text;
begin
  clean_code := public.betai_normalize_referral_code(p_referral_code);

  if p_referred_id is null or clean_code = '' then
    return false;
  end if;

  select email, raw_user_meta_data->>'username'
  into auth_email, auth_username
  from auth.users
  where id = p_referred_id;

  perform public.betai_upsert_profile_for_user(
    p_referred_id,
    coalesce(p_referred_email, auth_email),
    auth_username
  );

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
  values (referrer_profile.id, p_referred_id, clean_code, lower(coalesce(p_referred_email, auth_email, '')))
  on conflict (referred_id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    perform public.betai_award_referral_rewards(referrer_profile.id);
    return false;
  end if;

  perform public.betai_award_referral_rewards(referrer_profile.id);

  return true;
end;
$$;

-- 9) Dashboard poleceń.
drop function if exists public.get_referral_dashboard(uuid);

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
        referral_reward_total = rewards,
        updated_at = now()
    where id = p_user_id;

  return query select code, cnt, cnt, rewards;
end;
$$;

-- 10) Jeden bezpieczny trigger po rejestracji.
create or replace function public.betai_auth_after_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  username_meta text;
begin
  username_meta := coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'display_name');
  perform public.betai_upsert_profile_for_user(new.id, new.email, username_meta);
  perform public.ensure_referral_code(new.id);

  code := public.betai_normalize_referral_code(new.raw_user_meta_data->>'referral_code');
  if code <> '' then
    perform public.register_referral_signup(new.id, code, new.email);
  end if;

  return new;
exception
  when others then
    -- Nie blokuj tworzenia konta, nawet jeśli polecenie się nie zapisze.
    raise warning 'betai_auth_after_signup skipped: %', sqlerrm;
    return new;
end;
$$;

-- Usuwamy stare triggery, które mogły wywoływać błąd bazy przy rejestracji.
drop trigger if exists betai_auth_referral_after_signup on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_create_profile on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists betai_auth_after_signup_trigger on auth.users;

create trigger betai_auth_after_signup_trigger
after insert on auth.users
for each row
execute function public.betai_auth_after_signup();

-- 11) Uzupełnij profile i kody dla istniejących userów.
insert into public.profiles (id, email, username, public_slug, role, wallet, plan, subscription_status, is_admin, is_premium, created_at, updated_at)
select
  u.id,
  lower(u.email),
  coalesce(nullif(u.raw_user_meta_data->>'username',''), nullif(u.raw_user_meta_data->>'display_name',''), split_part(u.email, '@', 1), 'user'),
  lower(regexp_replace(coalesce(nullif(u.raw_user_meta_data->>'username',''), nullif(u.raw_user_meta_data->>'display_name',''), split_part(u.email, '@', 1), 'user'), '[^a-zA-Z0-9]+', '-', 'g')),
  'user',
  0,
  case when lower(u.email) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then 'premium' else 'free' end,
  case when lower(u.email) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then 'active' else 'free' end,
  case when lower(u.email) = 'smilhytv@gmail.com' then true else false end,
  case when lower(u.email) in ('smilhytv@gmail.com', 'buchajson1988@gmail.com') then true else false end,
  now(),
  now()
from auth.users u
on conflict (id) do update set
  email = coalesce(nullif(public.profiles.email, ''), excluded.email),
  username = coalesce(nullif(public.profiles.username, ''), excluded.username),
  public_slug = coalesce(nullif(public.profiles.public_slug, ''), excluded.public_slug),
  updated_at = now();

select public.ensure_referral_code(id)
from public.profiles
where coalesce(referral_code, '') = '';

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

grant execute on function public.betai_upsert_profile_for_user(uuid, text, text) to authenticated;
grant execute on function public.ensure_referral_code(uuid) to authenticated;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
grant execute on function public.register_referral_signup(uuid, text, text) to authenticated;
grant select on public.referrals to authenticated;
grant select on public.referral_rewards to authenticated;

commit;
