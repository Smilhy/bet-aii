
-- supabase/version_1033_persistent_follow_rewards_wallet.sql
-- Trwała pamięć:
-- - obserwowanie typera zapisuje się także po nazwie/kluczu, nie tylko UUID,
-- - nagrody rankingowe są odczytywane z betai_ranking_challenge_claims,
-- - portfel Coin jest źródłem prawdy w betai_token_wallets,
-- - RLS dla nowej tabeli follow keys.

create extension if not exists pgcrypto;

create table if not exists public.betai_tipster_follow_keys_v1033 (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade,
  follower_email text,
  tipster_id uuid,
  tipster_key text not null,
  tipster_name text,
  tipster_email text,
  created_at timestamptz not null default now()
);

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists follower_id uuid;

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists follower_email text;

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists tipster_id uuid;

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists tipster_key text;

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists tipster_name text;

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists tipster_email text;

alter table public.betai_tipster_follow_keys_v1033
  add column if not exists created_at timestamptz not null default now();

update public.betai_tipster_follow_keys_v1033
set
  follower_email = lower(trim(coalesce(follower_email, ''))),
  tipster_key = lower(trim(coalesce(tipster_key, tipster_name, tipster_email, ''))),
  tipster_email = lower(trim(coalesce(tipster_email, '')))
where true;

delete from public.betai_tipster_follow_keys_v1033
where tipster_key is null or trim(tipster_key) = '';

create unique index if not exists betai_tipster_follow_keys_v1033_uidx
on public.betai_tipster_follow_keys_v1033(follower_id, tipster_key);

create index if not exists betai_tipster_follow_keys_v1033_follower_email_idx
on public.betai_tipster_follow_keys_v1033(lower(follower_email));

alter table public.betai_tipster_follow_keys_v1033 enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_tipster_follow_keys_v1033'
      and policyname='betai_tipster_follow_keys_select_own_v1033'
  ) then
    create policy betai_tipster_follow_keys_select_own_v1033
    on public.betai_tipster_follow_keys_v1033
    for select
    using (
      auth.uid() = follower_id
      or lower(follower_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_tipster_follow_keys_v1033'
      and policyname='betai_tipster_follow_keys_insert_own_v1033'
  ) then
    create policy betai_tipster_follow_keys_insert_own_v1033
    on public.betai_tipster_follow_keys_v1033
    for insert
    with check (
      auth.uid() = follower_id
      or lower(follower_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_tipster_follow_keys_v1033'
      and policyname='betai_tipster_follow_keys_delete_own_v1033'
  ) then
    create policy betai_tipster_follow_keys_delete_own_v1033
    on public.betai_tipster_follow_keys_v1033
    for delete
    using (
      auth.uid() = follower_id
      or lower(follower_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

-- Upewnij się, że portfel ma stabilny unikalny email.
alter table if exists public.betai_token_wallets
  add column if not exists user_id uuid;

alter table if exists public.betai_token_wallets
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'betai_token_wallets_email_unique'
  ) then
    alter table public.betai_token_wallets
      add constraint betai_token_wallets_email_unique unique (email);
  end if;
exception when duplicate_table or duplicate_object then null;
end $$;

-- Tabela claimów rankingowych — jeżeli wcześniejszy SQL jej nie stworzył.
create table if not exists public.betai_ranking_challenge_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  challenge_key text not null,
  challenge_title text,
  reward_tokens integer not null default 1,
  period_key text not null,
  created_at timestamptz not null default now()
);

alter table public.betai_ranking_challenge_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'betai_ranking_challenge_claims_unique_user_period'
  ) then
    alter table public.betai_ranking_challenge_claims
      add constraint betai_ranking_challenge_claims_unique_user_period
      unique (user_id, challenge_key, period_key);
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='betai_ranking_challenge_claims'
      and policyname='ranking_claims_select_own_v1033'
  ) then
    create policy ranking_claims_select_own_v1033
    on public.betai_ranking_challenge_claims
    for select
    using (
      auth.uid() = user_id
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

select 'v1033 persistent follow rewards wallet ready' as status;
