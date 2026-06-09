-- WERSJA 1437 — FIX ODBIORU MISJI / PORTFEL COINÓW
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Naprawia sytuację:
-- - misja ma 1/1, ale kliknięcie "Odbierz +1" pokazuje błąd,
-- - przyczyną najczęściej jest zapis do betai_token_wallets przez ON CONFLICT(email),
--   gdy w bazie istnieje indeks lower(email), a nie constraint dokładnie na email.
--
-- Ta wersja NIE używa ON CONFLICT(email).
-- Najpierw robi UPDATE po lower(email), a jeśli portfela nie ma, INSERT.
-- Nie usuwa danych.

create extension if not exists pgcrypto;

create table if not exists public.community_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  reward_key text not null,
  reward_title text,
  period_key text,
  claimed boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.community_reward_claims add column if not exists user_id uuid;
alter table public.community_reward_claims add column if not exists email text;
alter table public.community_reward_claims add column if not exists reward_key text;
alter table public.community_reward_claims add column if not exists reward_title text;
alter table public.community_reward_claims add column if not exists period_key text;
alter table public.community_reward_claims add column if not exists claimed boolean not null default true;
alter table public.community_reward_claims add column if not exists created_at timestamptz not null default now();

create index if not exists community_reward_claims_user_reward_created_idx
  on public.community_reward_claims (user_id, reward_key, created_at desc);

create index if not exists community_reward_claims_email_reward_created_idx
  on public.community_reward_claims (lower(email), reward_key, created_at desc);

create table if not exists public.betai_token_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  balance integer not null default 0,
  welcome_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.betai_token_wallets add column if not exists user_id uuid;
alter table public.betai_token_wallets add column if not exists email text;
alter table public.betai_token_wallets add column if not exists balance integer not null default 0;
alter table public.betai_token_wallets add column if not exists welcome_bonus_claimed boolean not null default false;
alter table public.betai_token_wallets add column if not exists updated_at timestamptz not null default now();

create unique index if not exists betai_token_wallets_email_lower_uidx
  on public.betai_token_wallets (lower(email))
  where email is not null and email <> '';

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  delta_tokens integer not null default 0,
  delta_pln numeric not null default 0,
  reason text,
  ref_type text,
  ref_id text,
  created_at timestamptz not null default now()
);

alter table public.betai_token_transactions add column if not exists user_id uuid;
alter table public.betai_token_transactions add column if not exists email text;
alter table public.betai_token_transactions add column if not exists delta_tokens integer not null default 0;
alter table public.betai_token_transactions add column if not exists delta_pln numeric not null default 0;
alter table public.betai_token_transactions add column if not exists reason text;
alter table public.betai_token_transactions add column if not exists ref_type text;
alter table public.betai_token_transactions add column if not exists ref_id text;
alter table public.betai_token_transactions add column if not exists created_at timestamptz not null default now();

create index if not exists betai_token_transactions_email_created_idx
  on public.betai_token_transactions (lower(email), created_at desc);

alter table public.community_posts add column if not exists author_id uuid;
alter table public.community_posts add column if not exists author_email text;

alter table public.community_chat_messages add column if not exists author_id uuid;
alter table public.community_chat_messages add column if not exists author_email text;

alter table public.community_comments add column if not exists author_id uuid;
alter table public.community_comments add column if not exists author_email text;

create index if not exists community_posts_author_created_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists community_posts_email_created_idx
  on public.community_posts (lower(author_email), created_at desc);

create index if not exists community_chat_messages_author_created_idx
  on public.community_chat_messages (author_id, created_at desc);

create index if not exists community_chat_messages_email_created_idx
  on public.community_chat_messages (lower(author_email), created_at desc);

create index if not exists community_comments_author_created_idx
  on public.community_comments (author_id, created_at desc);

create index if not exists community_comments_email_created_idx
  on public.community_comments (lower(author_email), created_at desc);

drop function if exists public.claim_community_reward_v1437(uuid, text, text, text);

create function public.claim_community_reward_v1437(
  p_user_id uuid,
  p_email text,
  p_reward_key text,
  p_reward_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_key text := lower(trim(coalesce(p_reward_key, '')));
  v_title text := coalesce(p_reward_title, p_reward_key);
  v_cutoff timestamptz := now() - interval '24 hours';
  v_period_key text := to_char(now(), 'YYYY-MM-DD') || ':' || v_key;

  v_recent_claim boolean := false;
  v_done boolean := false;
  v_count integer := 0;
  v_new_balance integer := 0;

  v_daily_chat_claimed boolean := false;
  v_daily_post_claimed boolean := false;
begin
  if p_user_id is null or v_email = '' or v_key = '' then
    return jsonb_build_object(
      'claimed', false,
      'message', 'Brak konta użytkownika. Zaloguj się ponownie.',
      'rule', 'missing_user'
    );
  end if;

  select exists (
    select 1
    from public.community_reward_claims c
    where c.reward_key = v_key
      and c.created_at >= v_cutoff
      and (
        c.user_id = p_user_id
        or lower(coalesce(c.email, '')) = v_email
      )
    limit 1
  ) into v_recent_claim;

  if v_recent_claim then
    return jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'message', 'Ta misja była już odebrana. Kolejny coin możesz odebrać po 24h.',
      'rule', 'one_claim_per_24h'
    );
  end if;

  if v_key = 'daily_chat' then
    select exists (
      select 1
      from public.community_chat_messages m
      where m.created_at >= v_cutoff
        and (
          m.author_id = p_user_id
          or lower(coalesce(m.author_email, '')) = v_email
        )
      limit 1
    ) into v_done;

  elsif v_key = 'daily_post' then
    select exists (
      select 1
      from public.community_posts p
      where p.created_at >= v_cutoff
        and (
          p.author_id = p_user_id
          or lower(coalesce(p.author_email, '')) = v_email
        )
      limit 1
    ) into v_done;

  elsif v_key = 'daily_active' then
    select exists (
      select 1
      from public.community_reward_claims r
      where r.reward_key = 'daily_chat'
        and r.created_at >= v_cutoff
        and (
          r.user_id = p_user_id
          or lower(coalesce(r.email, '')) = v_email
        )
    ) into v_daily_chat_claimed;

    select exists (
      select 1
      from public.community_reward_claims r
      where r.reward_key = 'daily_post'
        and r.created_at >= v_cutoff
        and (
          r.user_id = p_user_id
          or lower(coalesce(r.email, '')) = v_email
        )
    ) into v_daily_post_claimed;

    select count(*)::integer into v_count
    from (
      select id::text
      from public.community_chat_messages m
      where not coalesce(v_daily_chat_claimed, false)
        and m.created_at >= v_cutoff
        and (
          m.author_id = p_user_id
          or lower(coalesce(m.author_email, '')) = v_email
        )

      union all

      select id::text
      from public.community_posts p
      where not coalesce(v_daily_post_claimed, false)
        and p.created_at >= v_cutoff
        and (
          p.author_id = p_user_id
          or lower(coalesce(p.author_email, '')) = v_email
        )

      union all

      select id::text
      from public.community_comments c
      where c.created_at >= v_cutoff
        and (
          c.author_id = p_user_id
          or lower(coalesce(c.author_email, '')) = v_email
        )
    ) activity;

    v_done := coalesce(v_count, 0) >= 3;

  else
    return jsonb_build_object(
      'claimed', false,
      'message', 'Nieznana misja.',
      'rule', 'unknown_reward'
    );
  end if;

  if not coalesce(v_done, false) then
    return jsonb_build_object(
      'claimed', false,
      'already_claimed', false,
      'message',
        case
          when v_key = 'daily_chat' then 'Najpierw napisz wiadomość na czacie.'
          when v_key = 'daily_post' then 'Najpierw dodaj post.'
          when v_key = 'daily_active' then 'Najpierw wykonaj łącznie 3 nieodebrane aktywności.'
          else 'Najpierw wykonaj wymaganą akcję.'
        end,
      'rule', 'action_required',
      'progress', coalesce(v_count, 0)
    );
  end if;

  -- Najpierw zapis claim, żeby w razie równoległego kliku nie naliczyć drugi raz.
  insert into public.community_reward_claims (
    user_id,
    email,
    reward_key,
    reward_title,
    period_key,
    claimed,
    created_at
  )
  values (
    p_user_id,
    v_email,
    v_key,
    v_title,
    v_period_key,
    true,
    now()
  );

  -- Bezpieczne dodanie coina bez ON CONFLICT(email).
  update public.betai_token_wallets
  set
    balance = coalesce(balance, 0) + 1,
    user_id = coalesce(user_id, p_user_id),
    updated_at = now()
  where lower(coalesce(email, '')) = v_email
  returning balance into v_new_balance;

  if v_new_balance is null then
    begin
      insert into public.betai_token_wallets (
        user_id,
        email,
        balance,
        updated_at
      )
      values (
        p_user_id,
        v_email,
        1,
        now()
      )
      returning balance into v_new_balance;
    exception when unique_violation then
      update public.betai_token_wallets
      set
        balance = coalesce(balance, 0) + 1,
        user_id = coalesce(user_id, p_user_id),
        updated_at = now()
      where lower(coalesce(email, '')) = v_email
      returning balance into v_new_balance;
    end;
  end if;

  insert into public.betai_token_transactions (
    user_id,
    email,
    delta_tokens,
    delta_pln,
    reason,
    ref_type,
    ref_id,
    created_at
  )
  values (
    p_user_id,
    v_email,
    1,
    0,
    'community_reward',
    'community_mission',
    v_key,
    now()
  );

  return jsonb_build_object(
    'claimed', true,
    'already_claimed', false,
    'reward_tokens', 1,
    'new_balance', coalesce(v_new_balance, 0),
    'period_key', v_period_key,
    'message', 'Misja wykonana. Dodano +1 coin.'
  );
end;
$$;

grant execute on function public.claim_community_reward_v1437(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';

select 'WERSJA 1437 community mission claim wallet fix ready' as status;
