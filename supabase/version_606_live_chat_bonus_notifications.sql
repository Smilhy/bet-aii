-- WERSJA 606 — bonusy live chatu + powiadomienia
-- Uruchom w Supabase SQL Editor.
-- Logika:
-- 1) Pierwsza poprawna wiadomość użytkownika w danym dniu = +1 żeton raz na dobę.
-- 2) Lider czatu za poprzednią dobę o 00:00:
--    FREE = +1 żeton, PREMIUM = +2 żetony.
-- 3) Każdy przyznany bonus tworzy powiadomienie w betai_system_notifications.
-- 4) Antyspam: do rankingu lidera liczą się tylko sensowne wiadomości, bez pustych/krótkich/duplikatów.

create extension if not exists pgcrypto;

create table if not exists public.betai_token_wallets (
  email text primary key,
  user_id uuid,
  balance integer not null default 0 check (balance >= 0),
  welcome_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.betai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  delta_tokens integer not null default 0,
  delta_pln numeric not null default 0,
  reason text not null default 'activity',
  ref_type text,
  ref_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null default 'Wiadomość BetAI',
  body text,
  message text,
  reward_tokens integer not null default 0,
  sent_by text not null default 'betai',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.live_chat_daily_message_rewards (
  reward_date date not null,
  email text not null,
  user_id uuid,
  user_name text,
  tokens_awarded integer not null default 1,
  message_id uuid,
  created_at timestamptz not null default now(),
  primary key (reward_date, email)
);

create table if not exists public.live_chat_daily_rewards (
  reward_date date primary key,
  winner_email text not null,
  winner_name text,
  message_count integer not null default 0,
  tokens_awarded integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.live_chat_daily_rewards
  add column if not exists winner_user_id uuid,
  add column if not exists reward_type text default 'daily_leader';

create index if not exists live_chat_daily_message_rewards_email_idx
  on public.live_chat_daily_message_rewards(lower(email), reward_date desc);

create index if not exists live_chat_messages_day_email_idx
  on public.live_chat_messages(created_at desc, lower(user_email));

create index if not exists betai_system_notifications_recipient_idx
  on public.betai_system_notifications(lower(recipient_email), created_at desc);

create index if not exists betai_token_transactions_email_idx
  on public.betai_token_transactions(lower(email), created_at desc);

alter table public.live_chat_daily_message_rewards enable row level security;
alter table public.live_chat_daily_rewards enable row level security;
alter table public.betai_token_wallets enable row level security;
alter table public.betai_token_transactions enable row level security;
alter table public.betai_system_notifications enable row level security;

-- Policies bezpieczne dla działania aplikacji.
drop policy if exists "live_chat_daily_message_rewards_select_own" on public.live_chat_daily_message_rewards;
create policy "live_chat_daily_message_rewards_select_own"
on public.live_chat_daily_message_rewards
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com');

drop policy if exists "live_chat_daily_rewards_select_all" on public.live_chat_daily_rewards;
create policy "live_chat_daily_rewards_select_all"
on public.live_chat_daily_rewards
for select
to authenticated
using (true);

drop policy if exists "betai_wallets_auth_select" on public.betai_token_wallets;
create policy "betai_wallets_auth_select" on public.betai_token_wallets for select to authenticated using (true);
drop policy if exists "betai_wallets_auth_insert" on public.betai_token_wallets;
create policy "betai_wallets_auth_insert" on public.betai_token_wallets for insert to authenticated with check (true);
drop policy if exists "betai_wallets_auth_update" on public.betai_token_wallets;
create policy "betai_wallets_auth_update" on public.betai_token_wallets for update to authenticated using (true) with check (true);

drop policy if exists "betai_transactions_auth_select" on public.betai_token_transactions;
create policy "betai_transactions_auth_select" on public.betai_token_transactions for select to authenticated using (true);
drop policy if exists "betai_transactions_auth_insert" on public.betai_token_transactions;
create policy "betai_transactions_auth_insert" on public.betai_token_transactions for insert to authenticated with check (true);

drop policy if exists "betai_notifications_auth_select" on public.betai_system_notifications;
create policy "betai_notifications_auth_select"
on public.betai_system_notifications
for select
to authenticated
using (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com');

drop policy if exists "betai_notifications_auth_insert" on public.betai_system_notifications;
create policy "betai_notifications_auth_insert" on public.betai_system_notifications for insert to authenticated with check (true);

drop policy if exists "betai_notifications_auth_update" on public.betai_system_notifications;
create policy "betai_notifications_auth_update"
on public.betai_system_notifications
for update
to authenticated
using (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com')
with check (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com');

create or replace function public.betai_add_tokens_with_notification_v606(
  p_email text,
  p_user_id uuid,
  p_tokens integer,
  p_reason text,
  p_title text,
  p_body text,
  p_ref_type text default 'live_chat_bonus',
  p_ref_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_tokens integer := greatest(coalesce(p_tokens, 0), 0);
begin
  if v_email = '' or v_tokens <= 0 then
    return;
  end if;

  insert into public.betai_token_wallets(email, user_id, balance, welcome_bonus_claimed, updated_at)
  values (v_email, p_user_id, v_tokens, true, now())
  on conflict (email) do update
  set balance = public.betai_token_wallets.balance + excluded.balance,
      user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
      updated_at = now();

  insert into public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_data)
  values (v_email, v_tokens, 0, p_reason, p_ref_type, p_ref_data);

  insert into public.betai_system_notifications(recipient_email, title, body, message, reward_tokens, sent_by, is_read)
  values (v_email, p_title, p_body, p_body, v_tokens, 'betai', false);
end;
$$;

create or replace function public.award_live_chat_first_message_bonus_v606(
  p_email text,
  p_user_id uuid default null,
  p_user_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_today date := current_date;
  v_inserted boolean := false;
begin
  if v_email = '' then
    return jsonb_build_object('awarded', false, 'reason', 'missing_email');
  end if;

  insert into public.live_chat_daily_message_rewards(reward_date, email, user_id, user_name, tokens_awarded)
  values (v_today, v_email, p_user_id, coalesce(p_user_name, split_part(v_email, '@', 1)), 1)
  on conflict (reward_date, email) do nothing;

  get diagnostics v_inserted = row_count;

  if not v_inserted then
    return jsonb_build_object('awarded', false, 'reason', 'already_awarded_today', 'tokens_awarded', 0);
  end if;

  perform public.betai_add_tokens_with_notification_v606(
    v_email,
    p_user_id,
    1,
    'live_chat_first_message_daily',
    'Bonus za aktywność na czacie 💬',
    'Dostałeś +1 żeton za pierwszą wiadomość dnia na BetAI Live Chat. Kolejne wiadomości dzisiaj nie dają już tego bonusu.',
    'live_chat_daily_message_rewards',
    jsonb_build_object('reward_date', v_today)
  );

  return jsonb_build_object('awarded', true, 'tokens_awarded', 1, 'reward_date', v_today);
end;
$$;

create or replace function public.award_live_chat_daily_leader_v606(p_reward_date date default current_date - 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner record;
  v_tokens integer := 1;
  v_is_premium boolean := false;
  v_existing public.live_chat_daily_rewards%rowtype;
begin
  select * into v_existing
  from public.live_chat_daily_rewards
  where reward_date = p_reward_date;

  if v_existing.reward_date is not null then
    return jsonb_build_object('awarded', false, 'reason', 'already_awarded', 'winner_email', v_existing.winner_email, 'tokens_awarded', v_existing.tokens_awarded);
  end if;

  with valid_messages as (
    select
      lower(trim(user_email)) as email,
      max(user_name) as name,
      count(distinct md5(lower(trim(message)))) as valid_count
    from public.live_chat_messages
    where created_at >= p_reward_date::timestamptz
      and created_at < (p_reward_date + 1)::timestamptz
      and lower(trim(coalesce(user_email, ''))) <> ''
      and lower(trim(coalesce(user_email, ''))) <> 'smilhytv@gmail.com'
      and char_length(trim(coalesce(message, ''))) >= 3
      and coalesce(message, '') ~ '[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]'
    group by lower(trim(user_email))
  )
  select email, coalesce(name, split_part(email, '@', 1)) as name, valid_count
  into v_winner
  from valid_messages
  order by valid_count desc, email asc
  limit 1;

  if v_winner.email is null then
    return jsonb_build_object('awarded', false, 'reason', 'no_valid_messages');
  end if;

  select exists(
    select 1
    from public.profiles p
    where lower(coalesce(p.email, '')) = v_winner.email
      and (
        coalesce(p.is_premium, false) = true
        or lower(coalesce(p.plan, '')) = 'premium'
        or lower(coalesce(p.subscription_status, '')) in ('active', 'trialing')
      )
  ) into v_is_premium;

  v_tokens := case when v_is_premium then 2 else 1 end;

  insert into public.live_chat_daily_rewards(reward_date, winner_email, winner_name, message_count, tokens_awarded, reward_type)
  values (p_reward_date, v_winner.email, v_winner.name, v_winner.valid_count, v_tokens, 'daily_leader');

  perform public.betai_add_tokens_with_notification_v606(
    v_winner.email,
    null,
    v_tokens,
    'live_chat_daily_leader',
    'Wygrałeś ranking aktywności czatu 🏆',
    case when v_is_premium
      then 'Gratulacje! Byłeś liderem BetAI Live Chat za poprzednią dobę. Konto Premium daje Ci +2 żetony.'
      else 'Gratulacje! Byłeś liderem BetAI Live Chat za poprzednią dobę. Dostałeś +1 żeton.'
    end,
    'live_chat_daily_rewards',
    jsonb_build_object('reward_date', p_reward_date, 'message_count', v_winner.valid_count, 'premium', v_is_premium)
  );

  return jsonb_build_object('awarded', true, 'winner_email', v_winner.email, 'winner_name', v_winner.name, 'message_count', v_winner.valid_count, 'tokens_awarded', v_tokens, 'premium', v_is_premium);
end;
$$;

-- Uprawnienia do RPC.
grant execute on function public.award_live_chat_first_message_bonus_v606(text, uuid, text) to authenticated;
grant execute on function public.award_live_chat_daily_leader_v606(date) to authenticated;
grant execute on function public.betai_add_tokens_with_notification_v606(text, uuid, integer, text, text, text, text, jsonb) to authenticated;

-- Realtime powiadomień i portfeli.
do $$
begin
  begin alter publication supabase_realtime add table public.betai_system_notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.betai_token_wallets; exception when duplicate_object then null; end;
end $$;

-- TEST / ręczne uruchomienie nagrody lidera za wczoraj:
-- select public.award_live_chat_daily_leader_v606(current_date - 1);
--
-- Automatyzacja 00:00:
-- Najlepiej ustaw w Supabase Scheduled Function / cron wywołanie:
-- select public.award_live_chat_daily_leader_v606(current_date - 1);
