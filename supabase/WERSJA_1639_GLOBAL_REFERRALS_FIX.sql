-- WERSJA 1639 — GLOBALNY FIX POLECEŃ / REFERRALS
-- Uruchom RAZ w Supabase SQL Editor.
-- Naprawia globalnie:
-- 1) kompatybilność referral_rewards: reward_coins/reward_amount, threshold_count/threshold, currency/reward_type,
-- 2) register_referral_signup nie wywala już całej rejestracji przez nagrody,
-- 3) trigger po rejestracji czyta referral_code, ref, referralCode i r z auth metadata,
-- 4) backfill dopisuje brakujące polecenia dla istniejących auth.users z refem w metadata,
-- 5) przelicza referrals_count / buyers_count / referral_reward_total dla profili.

create extension if not exists pgcrypto;

-- Podstawowe kolumny profilu wymagane przez polecenia.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referrals_count integer not null default 0;
alter table public.profiles add column if not exists buyers_count integer not null default 0;
alter table public.profiles add column if not exists referral_reward_total integer not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (lower(referral_code))
  where referral_code is not null and referral_code <> '';

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  referrer_code text,
  referred_email text,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
create index if not exists referrals_created_at_idx on public.referrals(created_at desc);
create unique index if not exists referrals_referred_id_unique_idx on public.referrals(referred_id);

-- Tabela nagród: dodajemy obie wersje nazw kolumn, bo wcześniejsze SQL-e w projekcie używały różnych nazw.
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  threshold_count integer not null default 0,
  reward_coins integer not null default 0,
  currency text not null default 'coin',
  created_at timestamptz not null default now()
);

alter table public.referral_rewards add column if not exists threshold_count integer not null default 0;
alter table public.referral_rewards add column if not exists reward_coins integer not null default 0;
alter table public.referral_rewards add column if not exists currency text not null default 'coin';
alter table public.referral_rewards add column if not exists threshold integer not null default 0;
alter table public.referral_rewards add column if not exists reward_amount integer not null default 0;
alter table public.referral_rewards add column if not exists reward_type text not null default 'coin';

update public.referral_rewards
set
  threshold_count = coalesce(nullif(threshold_count, 0), nullif(threshold, 0), 0),
  threshold = coalesce(nullif(threshold, 0), nullif(threshold_count, 0), 0),
  reward_coins = coalesce(nullif(reward_coins, 0), nullif(reward_amount, 0), 0),
  reward_amount = coalesce(nullif(reward_amount, 0), nullif(reward_coins, 0), 0),
  currency = coalesce(nullif(currency, ''), nullif(reward_type, ''), 'coin'),
  reward_type = coalesce(nullif(reward_type, ''), nullif(currency, ''), 'coin');

create index if not exists referral_rewards_referrer_id_idx on public.referral_rewards(referrer_id);
create unique index if not exists referral_rewards_referrer_threshold_count_unique
  on public.referral_rewards(referrer_id, threshold_count);

create or replace function public.betai_normalize_referral_code(value text)
returns text
language sql
immutable
as $$
  select upper(left(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '', 'g'), 32));
$$;

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
  v_email text;
  v_username text;
  v_slug text;
begin
  if p_user_id is null then
    return;
  end if;

  v_email := lower(coalesce(p_email, ''));
  v_username := coalesce(nullif(trim(p_username), ''), nullif(split_part(v_email, '@', 1), ''), 'user');
  v_slug := lower(regexp_replace(v_username, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := left(replace(p_user_id::text, '-', ''), 16);
  end if;

  insert into public.profiles (id, email, username, display_name, public_slug, created_at, updated_at)
  values (p_user_id, v_email, v_username, v_username, v_slug, now(), now())
  on conflict (id) do update set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    username = coalesce(nullif(public.profiles.username, ''), excluded.username),
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    public_slug = coalesce(nullif(public.profiles.public_slug, ''), excluded.public_slug),
    updated_at = now();
end;
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
  auth_email text;
  auth_username text;
begin
  if p_user_id is null then
    return '';
  end if;

  select email, coalesce(raw_user_meta_data->>'username', raw_user_meta_data->>'display_name')
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
      set referral_code = existing_code, updated_at = now()
      where id = p_user_id and referral_code is distinct from existing_code;
    return existing_code;
  end if;

  base_code := public.betai_normalize_referral_code(
    coalesce(profile_row.username, profile_row.display_name, split_part(profile_row.email, '@', 1), left(p_user_id::text, 8))
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
    set referral_code = final_code, updated_at = now()
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
  ref_count int := 0;
  ref_email text := '';
  threshold_row record;
  v_reward_total int := 0;
  reward_inserted int := 0;
begin
  if p_referrer_id is null then
    return;
  end if;

  select count(*)::int into ref_count
  from public.referrals
  where referrer_id = p_referrer_id;

  select lower(coalesce(email, '')) into ref_email
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
      insert into public.referral_rewards(
        referrer_id,
        threshold_count,
        reward_coins,
        currency,
        threshold,
        reward_amount,
        reward_type
      )
      values (
        p_referrer_id,
        threshold_row.threshold_count,
        threshold_row.reward_coins,
        'coin',
        threshold_row.threshold_count,
        threshold_row.reward_coins,
        'coin'
      )
      on conflict (referrer_id, threshold_count) do nothing;

      get diagnostics reward_inserted = row_count;

      -- Opcjonalne księgowanie coinów nie może blokować referral signup.
      if reward_inserted > 0 and coalesce(ref_email, '') <> '' then
        begin
          if to_regclass('public.betai_token_wallets') is not null then
            insert into public.betai_token_wallets(email, user_id, balance, welcome_bonus_claimed, updated_at)
            values (ref_email, p_referrer_id, threshold_row.reward_coins, true, now())
            on conflict (email)
            do update set
              balance = coalesce(public.betai_token_wallets.balance, 0) + excluded.balance,
              user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
              updated_at = now();
          end if;
        exception when others then
          raise warning 'referral wallet reward skipped: %', sqlerrm;
        end;

        begin
          if to_regclass('public.betai_token_transactions') is not null then
            insert into public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_id)
            values (ref_email, threshold_row.reward_coins, 0, 'referral_reward', 'referral_rewards', threshold_row.threshold_count::text);
          end if;
        exception when others then
          raise warning 'referral transaction skipped: %', sqlerrm;
        end;

        begin
          if to_regclass('public.betai_system_notifications') is not null then
            insert into public.betai_system_notifications(recipient_email, title, body, message, is_read)
            values (
              ref_email,
              'Nagroda za polecenia',
              'Gratulacje! Osiągnąłeś próg ' || threshold_row.threshold_count || ' poleceń i otrzymujesz +' || threshold_row.reward_coins || ' coin.',
              'Gratulacje! Osiągnąłeś próg ' || threshold_row.threshold_count || ' poleceń i otrzymujesz +' || threshold_row.reward_coins || ' coin.',
              false
            );
          end if;
        exception when others then
          raise warning 'referral notification skipped: %', sqlerrm;
        end;
      end if;
    end if;
  end loop;

  select coalesce(sum(coalesce(reward_coins, reward_amount, 0)), 0)::int
    into v_reward_total
  from public.referral_rewards
  where referrer_id = p_referrer_id;

  update public.profiles
    set referrals_count = ref_count,
        buyers_count = ref_count,
        referral_reward_total = v_reward_total,
        updated_at = now()
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
  auth_email text;
  auth_username text;
begin
  clean_code := public.betai_normalize_referral_code(p_referral_code);

  if p_referred_id is null or clean_code = '' then
    return false;
  end if;

  select email, coalesce(raw_user_meta_data->>'username', raw_user_meta_data->>'display_name')
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
  where public.betai_normalize_referral_code(referral_code) = clean_code
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

  perform public.betai_award_referral_rewards(referrer_profile.id);

  return inserted_id is not null;
exception
  when others then
    -- Referral nie może już wysypać rejestracji ani triggera.
    raise warning 'register_referral_signup skipped: %', sqlerrm;
    return false;
end;
$$;

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
  code text := '';
  cnt int := 0;
  rewards int := 0;
begin
  if p_user_id is null then
    return query select ''::text, 0::integer, 0::integer, 0::integer;
    return;
  end if;

  code := public.ensure_referral_code(p_user_id);

  select count(*)::int into cnt
  from public.referrals
  where referrer_id = p_user_id;

  select coalesce(sum(coalesce(reward_coins, reward_amount, 0)), 0)::int into rewards
  from public.referral_rewards
  where referrer_id = p_user_id;

  update public.profiles
    set referrals_count = cnt,
        buyers_count = cnt,
        referral_reward_total = rewards,
        updated_at = now()
    where id = p_user_id;

  return query select code::text, cnt::integer, cnt::integer, rewards::integer;
end;
$$;

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

  code := public.betai_normalize_referral_code(coalesce(
    new.raw_user_meta_data->>'referral_code',
    new.raw_user_meta_data->>'referralCode',
    new.raw_user_meta_data->>'ref',
    new.raw_user_meta_data->>'r',
    ''
  ));

  if code <> '' then
    perform public.register_referral_signup(new.id, code, new.email);
  end if;

  return new;
exception
  when others then
    raise warning 'betai_auth_after_signup skipped: %', sqlerrm;
    return new;
end;
$$;

-- Zostawiamy jeden aktualny trigger i usuwamy stare warianty, które mogły blokować lub dublować zapis.
drop trigger if exists betai_auth_referral_after_signup on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_create_profile on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists betai_auth_after_signup_trigger on auth.users;

create trigger betai_auth_after_signup_trigger
after insert on auth.users
for each row
execute function public.betai_auth_after_signup();

-- Backfill: dopisz brakujące profile, kody i polecenia dla istniejących kont, które mają ref w auth metadata.
do $$
declare
  u record;
  code text;
  p record;
begin
  for u in
    select id, email, raw_user_meta_data
    from auth.users
    order by created_at asc
  loop
    perform public.betai_upsert_profile_for_user(
      u.id,
      u.email,
      coalesce(u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'display_name')
    );

    perform public.ensure_referral_code(u.id);

    code := public.betai_normalize_referral_code(coalesce(
      u.raw_user_meta_data->>'referral_code',
      u.raw_user_meta_data->>'referralCode',
      u.raw_user_meta_data->>'ref',
      u.raw_user_meta_data->>'r',
      ''
    ));

    if code <> '' then
      perform public.register_referral_signup(u.id, code, u.email);
    end if;
  end loop;

  for p in select id from public.profiles loop
    perform public.betai_award_referral_rewards(p.id);
  end loop;
end $$;

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

grant execute on function public.betai_normalize_referral_code(text) to anon, authenticated;
grant execute on function public.ensure_referral_code(uuid) to authenticated;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
grant execute on function public.register_referral_signup(uuid, text, text) to anon, authenticated;
grant select on public.referrals to authenticated;
grant select on public.referral_rewards to authenticated;

select 'WERSJA 1639 GLOBAL REFERRALS FIX OK' as status;
