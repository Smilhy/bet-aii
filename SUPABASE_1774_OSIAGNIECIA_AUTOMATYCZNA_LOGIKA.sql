-- ============================================================
-- BET+AI — WERSJA 1774
-- AUTOMATYCZNA LOGIKA OSIĄGNIĘĆ TYPERA
--
-- Uruchom CAŁOŚĆ jeden raz w Supabase SQL Editor.
--
-- Zasada:
-- 1. aktualny postęp jest liczony z prawdziwych tabel,
-- 2. po wykonaniu akcji trigger automatycznie przelicza osiągnięcia,
-- 3. po zdobyciu odznaka zostaje odblokowana na stałe,
-- 4. frontend dostaje zmianę przez Supabase Realtime i od razu ją podświetla.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- Kolumny używane przez agregator. Polecenia są bezpieczne i niczego nie usuwają.
alter table public.profiles add column if not exists imported_total_tips integer not null default 0;
alter table public.profiles add column if not exists imported_won_tips integer not null default 0;
alter table public.profiles add column if not exists referrals_count integer not null default 0;
alter table public.profiles add column if not exists followers_count integer not null default 0;

alter table public.tips add column if not exists user_id uuid;
alter table public.tips add column if not exists author_id uuid;
alter table public.tips add column if not exists author_email text;
alter table public.tips add column if not exists username text;
alter table public.tips add column if not exists author_name text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists result text;
alter table public.tips add column if not exists result_status text;
alter table public.tips add column if not exists settlement_status text;

alter table public.community_reward_claims add column if not exists user_id uuid;
alter table public.community_reward_claims add column if not exists email text;
alter table public.community_reward_claims add column if not exists claimed boolean not null default true;

alter table public.profile_reviews add column if not exists reviewer_id uuid;
alter table public.profile_reviews add column if not exists reviewer_email text;
alter table public.profile_reviews add column if not exists is_approved boolean not null default true;

alter table public.betai_token_wallets add column if not exists user_id uuid;
alter table public.betai_token_wallets add column if not exists email text;
alter table public.betai_token_wallets add column if not exists balance integer not null default 0;

alter table public.betai_token_transactions add column if not exists user_id uuid;
alter table public.betai_token_transactions add column if not exists email text;
alter table public.betai_token_transactions add column if not exists delta_tokens integer not null default 0;

-- Trwały zapis postępu.
create table if not exists public.tipster_achievement_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  current_value numeric not null default 0,
  target_value numeric not null default 1,
  unlocked boolean not null default false,
  unlocked_at timestamptz,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create index if not exists tipster_achievement_progress_user_idx
  on public.tipster_achievement_progress(user_id, sort_order);

create index if not exists tips_achievement_author_id_idx on public.tips(author_id);
create index if not exists tips_achievement_user_id_idx on public.tips(user_id);
create index if not exists tips_achievement_author_email_idx on public.tips(lower(author_email));
create index if not exists tips_achievement_username_idx on public.tips(lower(username));
create index if not exists tips_achievement_author_name_idx on public.tips(lower(author_name));
create index if not exists community_reward_claims_achievement_user_idx
  on public.community_reward_claims(user_id, claimed);
create index if not exists profile_reviews_achievement_reviewer_idx
  on public.profile_reviews(reviewer_id);
create index if not exists token_transactions_achievement_user_idx
  on public.betai_token_transactions(user_id);
create index if not exists referrals_achievement_referrer_idx
  on public.referrals(referrer_id);
create index if not exists follows_achievement_tipster_idx
  on public.tipster_follows(tipster_id);

alter table public.tipster_achievement_progress enable row level security;

drop policy if exists tipster_achievement_progress_public_select_v1774
  on public.tipster_achievement_progress;

create policy tipster_achievement_progress_public_select_v1774
on public.tipster_achievement_progress
for select
to anon, authenticated
using (true);

grant select on public.tipster_achievement_progress to anon, authenticated;

-- Normalizacja nazw/aliasów.
create or replace function public.betai_achievement_identity_key_v1774(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '[^a-z0-9]+', '', 'g');
$$;

-- Rozpoznanie profilu po UUID, e-mailu albo nazwie.
create or replace function public.betai_resolve_profile_id_v1774(
  p_primary_id uuid,
  p_secondary_id uuid,
  p_email text,
  p_username text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_username_key text := public.betai_achievement_identity_key_v1774(p_username);
begin
  if p_primary_id is not null and exists(select 1 from public.profiles where id = p_primary_id) then
    return p_primary_id;
  end if;

  if p_secondary_id is not null and exists(select 1 from public.profiles where id = p_secondary_id) then
    return p_secondary_id;
  end if;

  if v_email <> '' then
    select id into v_id
    from public.profiles
    where lower(coalesce(email, '')) = v_email
    limit 1;

    if v_id is not null then return v_id; end if;
  end if;

  if v_username_key <> '' then
    select id into v_id
    from public.profiles
    where public.betai_achievement_identity_key_v1774(username) = v_username_key
    limit 1;
  end if;

  return v_id;
end;
$$;

-- Główny kalkulator wszystkich 9 osiągnięć.
create or replace function public.refresh_tipster_achievements_v1774(p_user_id uuid)
returns setof public.tipster_achievement_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text := '';
  v_username text := '';
  v_username_key text := '';

  v_tip_count integer := 0;
  v_won_count integer := 0;
  v_high_odds_count integer := 0;
  v_active_days integer := 0;
  v_referrals integer := 0;
  v_bonus_claims integer := 0;
  v_wallet_balance numeric := 0;
  v_lifetime_coins numeric := 0;
  v_followers integer := 0;
  v_ratings_given integer := 0;

  v_total_tips integer := 0;
  v_total_wins integer := 0;
  v_coins numeric := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  limit 1;

  if not found then
    return;
  end if;

  v_email := lower(trim(coalesce(v_profile.email, '')));
  v_username := trim(coalesce(v_profile.username, ''));
  v_username_key := public.betai_achievement_identity_key_v1774(v_username);

  select
    count(*)::integer,
    (count(*) filter (
      where lower(concat_ws(
        ' ',
        coalesce(t.status, ''),
        coalesce(t.result, ''),
        coalesce(t.result_status, ''),
        coalesce(t.settlement_status, '')
      )) ~ '(won|win|wygran)'
    ))::integer,
    (count(*) filter (where coalesce(t.odds, 0) > 3.00))::integer,
    count(distinct ((t.created_at at time zone 'UTC')::date))::integer
  into
    v_tip_count,
    v_won_count,
    v_high_odds_count,
    v_active_days
  from public.tips t
  where
    t.author_id = p_user_id
    or t.user_id = p_user_id
    or (
      v_email <> ''
      and lower(trim(coalesce(t.author_email, ''))) = v_email
    )
    or (
      v_username_key <> ''
      and (
        public.betai_achievement_identity_key_v1774(t.username) = v_username_key
        or public.betai_achievement_identity_key_v1774(t.author_name) = v_username_key
      )
    );

  -- Zachowuje także poprawne statystyki historyczne/importowane.
  v_total_tips := greatest(v_tip_count, coalesce(v_profile.imported_total_tips, 0));
  v_total_wins := greatest(v_won_count, coalesce(v_profile.imported_won_tips, 0));

  select count(*)::integer
  into v_referrals
  from public.referrals r
  where r.referrer_id = p_user_id;

  v_referrals := greatest(v_referrals, coalesce(v_profile.referrals_count, 0));

  select count(*)::integer
  into v_bonus_claims
  from public.community_reward_claims c
  where c.claimed is distinct from false
    and (
      c.user_id = p_user_id
      or (v_email <> '' and lower(trim(coalesce(c.email, ''))) = v_email)
    );

  select coalesce(max(w.balance), 0)
  into v_wallet_balance
  from public.betai_token_wallets w
  where
    w.user_id = p_user_id
    or (v_email <> '' and lower(trim(coalesce(w.email, ''))) = v_email);

  -- Liczymy monety zdobyte łącznie. Wydanie monet nie odbiera odznaki.
  select coalesce(sum(greatest(tx.delta_tokens, 0)), 0)
  into v_lifetime_coins
  from public.betai_token_transactions tx
  where
    tx.user_id = p_user_id
    or (v_email <> '' and lower(trim(coalesce(tx.email, ''))) = v_email);

  v_coins := greatest(v_wallet_balance, v_lifetime_coins);

  select count(*)::integer
  into v_followers
  from public.tipster_follows f
  where f.tipster_id = p_user_id;

  v_followers := greatest(v_followers, coalesce(v_profile.followers_count, 0));

  select count(distinct pr.profile_id)::integer
  into v_ratings_given
  from public.profile_reviews pr
  where pr.is_approved is distinct from false
    and (
      pr.reviewer_id = p_user_id
      or (v_email <> '' and lower(trim(coalesce(pr.reviewer_email, ''))) = v_email)
    );

  insert into public.tipster_achievement_progress (
    user_id,
    achievement_key,
    current_value,
    target_value,
    unlocked,
    unlocked_at,
    sort_order,
    updated_at
  )
  select
    p_user_id,
    values_row.achievement_key,
    greatest(values_row.current_value, 0),
    values_row.target_value,
    values_row.current_value >= values_row.target_value,
    case
      when values_row.current_value >= values_row.target_value then now()
      else null
    end,
    values_row.sort_order,
    now()
  from (
    values
      ('fanatyk',                 v_total_tips::numeric,       1000::numeric, 1::smallint),
      ('prawdziwy-wygrany',       v_total_wins::numeric,        500::numeric, 2::smallint),
      ('nieustraszony',           v_high_odds_count::numeric,    100::numeric, 3::smallint),
      ('lojalny',                 v_active_days::numeric,        180::numeric, 4::smallint),
      ('czlonek-rodziny',         v_referrals::numeric,           10::numeric, 5::smallint),
      ('lowca-bonusow',           v_bonus_claims::numeric,       100::numeric, 6::smallint),
      ('bogaty',                  v_coins::numeric,            10000::numeric, 7::smallint),
      ('slawny',                  v_followers::numeric,          500::numeric, 8::smallint),
      ('krytyk-bukmacherski',     v_ratings_given::numeric,        1::numeric, 9::smallint)
  ) as values_row(achievement_key, current_value, target_value, sort_order)
  on conflict (user_id, achievement_key)
  do update set
    current_value = excluded.current_value,
    target_value = excluded.target_value,
    -- Zdobytej odznaki nigdy nie blokujemy ponownie.
    unlocked = public.tipster_achievement_progress.unlocked or excluded.unlocked,
    unlocked_at = coalesce(
      public.tipster_achievement_progress.unlocked_at,
      excluded.unlocked_at
    ),
    sort_order = excluded.sort_order,
    updated_at = now();

  return query
  select progress.*
  from public.tipster_achievement_progress progress
  where progress.user_id = p_user_id
  order by progress.sort_order;
end;
$$;

-- RPC używane przez frontend. Przy każdym otwarciu profilu robi kontrolne przeliczenie.
create or replace function public.get_tipster_achievements_v1774(p_user_id uuid)
returns setof public.tipster_achievement_progress
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.refresh_tipster_achievements_v1774(p_user_id);
end;
$$;

grant execute on function public.get_tipster_achievements_v1774(uuid) to anon, authenticated;
grant execute on function public.refresh_tipster_achievements_v1774(uuid) to anon, authenticated;

-- ============================================================
-- TRIGGERY — automatyczne przeliczanie po każdej ważnej akcji.
-- ============================================================

create or replace function public.trg_achievement_tips_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_old_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_id := public.betai_resolve_profile_id_v1774(
      new.author_id,
      new.user_id,
      new.author_email,
      coalesce(new.username, new.author_name)
    );
  end if;

  if tg_op <> 'INSERT' then
    v_old_id := public.betai_resolve_profile_id_v1774(
      old.author_id,
      old.user_id,
      old.author_email,
      coalesce(old.username, old.author_name)
    );
  end if;

  if v_new_id is not null then
    perform public.refresh_tipster_achievements_v1774(v_new_id);
  end if;

  if v_old_id is not null and v_old_id is distinct from v_new_id then
    perform public.refresh_tipster_achievements_v1774(v_old_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_tips_v1774 on public.tips;
create trigger trg_achievement_tips_v1774
after insert or update or delete on public.tips
for each row execute function public.trg_achievement_tips_v1774();

create or replace function public.trg_achievement_rewards_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_old_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_id := public.betai_resolve_profile_id_v1774(new.user_id, null, new.email, null);
  end if;
  if tg_op <> 'INSERT' then
    v_old_id := public.betai_resolve_profile_id_v1774(old.user_id, null, old.email, null);
  end if;

  if v_new_id is not null then perform public.refresh_tipster_achievements_v1774(v_new_id); end if;
  if v_old_id is not null and v_old_id is distinct from v_new_id then
    perform public.refresh_tipster_achievements_v1774(v_old_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_rewards_v1774 on public.community_reward_claims;
create trigger trg_achievement_rewards_v1774
after insert or update or delete on public.community_reward_claims
for each row execute function public.trg_achievement_rewards_v1774();

create or replace function public.trg_achievement_referrals_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'DELETE' and new.referrer_id is not null then
    perform public.refresh_tipster_achievements_v1774(new.referrer_id);
  end if;
  if tg_op <> 'INSERT'
     and old.referrer_id is not null
     and (tg_op = 'DELETE' or old.referrer_id is distinct from new.referrer_id) then
    perform public.refresh_tipster_achievements_v1774(old.referrer_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_referrals_v1774 on public.referrals;
create trigger trg_achievement_referrals_v1774
after insert or update or delete on public.referrals
for each row execute function public.trg_achievement_referrals_v1774();

create or replace function public.trg_achievement_follows_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'DELETE' and new.tipster_id is not null then
    perform public.refresh_tipster_achievements_v1774(new.tipster_id);
  end if;
  if tg_op <> 'INSERT'
     and old.tipster_id is not null
     and (tg_op = 'DELETE' or old.tipster_id is distinct from new.tipster_id) then
    perform public.refresh_tipster_achievements_v1774(old.tipster_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_follows_v1774 on public.tipster_follows;
create trigger trg_achievement_follows_v1774
after insert or update or delete on public.tipster_follows
for each row execute function public.trg_achievement_follows_v1774();

create or replace function public.trg_achievement_reviews_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_old_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_id := public.betai_resolve_profile_id_v1774(new.reviewer_id, null, new.reviewer_email, null);
  end if;
  if tg_op <> 'INSERT' then
    v_old_id := public.betai_resolve_profile_id_v1774(old.reviewer_id, null, old.reviewer_email, null);
  end if;

  if v_new_id is not null then perform public.refresh_tipster_achievements_v1774(v_new_id); end if;
  if v_old_id is not null and v_old_id is distinct from v_new_id then
    perform public.refresh_tipster_achievements_v1774(v_old_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_reviews_v1774 on public.profile_reviews;
create trigger trg_achievement_reviews_v1774
after insert or update or delete on public.profile_reviews
for each row execute function public.trg_achievement_reviews_v1774();

create or replace function public.trg_achievement_token_tx_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_old_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_id := public.betai_resolve_profile_id_v1774(new.user_id, null, new.email, null);
  end if;
  if tg_op <> 'INSERT' then
    v_old_id := public.betai_resolve_profile_id_v1774(old.user_id, null, old.email, null);
  end if;

  if v_new_id is not null then perform public.refresh_tipster_achievements_v1774(v_new_id); end if;
  if v_old_id is not null and v_old_id is distinct from v_new_id then
    perform public.refresh_tipster_achievements_v1774(v_old_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_token_tx_v1774 on public.betai_token_transactions;
create trigger trg_achievement_token_tx_v1774
after insert or update or delete on public.betai_token_transactions
for each row execute function public.trg_achievement_token_tx_v1774();

create or replace function public.trg_achievement_wallet_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_old_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_id := public.betai_resolve_profile_id_v1774(new.user_id, null, new.email, null);
  end if;
  if tg_op <> 'INSERT' then
    v_old_id := public.betai_resolve_profile_id_v1774(old.user_id, null, old.email, null);
  end if;

  if v_new_id is not null then perform public.refresh_tipster_achievements_v1774(v_new_id); end if;
  if v_old_id is not null and v_old_id is distinct from v_new_id then
    perform public.refresh_tipster_achievements_v1774(v_old_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_achievement_wallet_v1774 on public.betai_token_wallets;
create trigger trg_achievement_wallet_v1774
after insert or update or delete on public.betai_token_wallets
for each row execute function public.trg_achievement_wallet_v1774();

-- Zmiany importowanych statystyk profilu też aktualizują osiągnięcia.
create or replace function public.trg_achievement_profile_v1774()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is not null then
    perform public.refresh_tipster_achievements_v1774(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_achievement_profile_v1774 on public.profiles;
create trigger trg_achievement_profile_v1774
after insert or update on public.profiles
for each row execute function public.trg_achievement_profile_v1774();

-- Realtime: frontend natychmiast rozświetla ikonę po zdobyciu.
alter table public.tipster_achievement_progress replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime
      add table public.tipster_achievement_progress;
  exception
    when duplicate_object then null;
  end;
end;
$$;

-- Pierwsze przeliczenie wszystkich istniejących profili.
do $$
declare
  profile_row record;
begin
  for profile_row in select id from public.profiles
  loop
    perform public.refresh_tipster_achievements_v1774(profile_row.id);
  end loop;
end;
$$;

commit;

-- Kontrola po uruchomieniu:
select
  p.username,
  a.achievement_key,
  a.current_value,
  a.target_value,
  a.unlocked,
  a.unlocked_at
from public.tipster_achievement_progress a
join public.profiles p on p.id = a.user_id
order by p.username, a.sort_order;
