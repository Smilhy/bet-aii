
-- supabase/version_999_live_ranking_challenges_follow_notifications.sql
-- Żywy ranking + obserwowanie + wyzwania 1 żeton + powiadomienia.
-- Safe/idempotent.

create table if not exists public.tipster_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  tipster_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, tipster_id)
);

alter table public.tipster_follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tipster_follows'
      and policyname = 'tipster_follows_select_all'
  ) then
    create policy tipster_follows_select_all
    on public.tipster_follows
    for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tipster_follows'
      and policyname = 'tipster_follows_insert_own'
  ) then
    create policy tipster_follows_insert_own
    on public.tipster_follows
    for insert
    with check (auth.uid() = follower_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tipster_follows'
      and policyname = 'tipster_follows_delete_own'
  ) then
    create policy tipster_follows_delete_own
    on public.tipster_follows
    for delete
    using (auth.uid() = follower_id);
  end if;
end $$;

create table if not exists public.betai_ranking_challenge_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  challenge_key text not null,
  challenge_title text not null,
  reward_tokens integer not null default 1,
  period_key text not null default to_char(now(), 'IYYY-IW'),
  created_at timestamptz not null default now(),
  unique (user_id, challenge_key, period_key)
);

alter table public.betai_ranking_challenge_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'betai_ranking_challenge_claims'
      and policyname = 'ranking_claims_select_own'
  ) then
    create policy ranking_claims_select_own
    on public.betai_ranking_challenge_claims
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'betai_ranking_challenge_claims'
      and policyname = 'ranking_claims_insert_own'
  ) then
    create policy ranking_claims_insert_own
    on public.betai_ranking_challenge_claims
    for insert
    with check (auth.uid() = user_id);
  end if;
end $$;

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

create or replace function public.claim_ranking_challenge_reward(
  p_user_id uuid,
  p_email text,
  p_challenge_key text,
  p_challenge_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'IYYY-IW');
  v_claim_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  insert into public.betai_ranking_challenge_claims (
    user_id,
    email,
    challenge_key,
    challenge_title,
    reward_tokens,
    period_key
  )
  values (
    p_user_id,
    lower(trim(p_email)),
    p_challenge_key,
    p_challenge_title,
    1,
    v_period
  )
  on conflict (user_id, challenge_key, period_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    return jsonb_build_object('claimed', false, 'reward_tokens', 0, 'period_key', v_period);
  end if;

  insert into public.betai_token_wallets (email, user_id, balance, updated_at)
  values (lower(trim(p_email)), p_user_id, 1, now())
  on conflict (email)
  do update set
    balance = coalesce(public.betai_token_wallets.balance, 0) + 1,
    user_id = coalesce(public.betai_token_wallets.user_id, excluded.user_id),
    updated_at = now();

  insert into public.betai_token_transactions (
    email,
    delta_tokens,
    delta_pln,
    reason,
    ref_type,
    ref_id
  )
  values (
    lower(trim(p_email)),
    1,
    0,
    'ranking_challenge:' || p_challenge_key,
    'ranking_challenge',
    v_claim_id::text
  );

  insert into public.betai_system_notifications (
    recipient_email,
    title,
    body,
    message,
    is_read,
    created_at
  )
  values (
    lower(trim(p_email)),
    'Wyzwanie ukończone',
    coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.',
    coalesce(p_challenge_title, 'Wyzwanie') || ': otrzymujesz 1 żeton.',
    false,
    now()
  );

  return jsonb_build_object('claimed', true, 'reward_tokens', 1, 'period_key', v_period);
end;
$$;

grant execute on function public.claim_ranking_challenge_reward(uuid, text, text, text) to authenticated;

-- Publiczny widok rankingu: wszyscy zarejestrowani użytkownicy + statystyki importowane.
create or replace view public.betai_live_ranking_v999 as
select
  p.id as tipster_id,
  p.id,
  p.email,
  coalesce(nullif(p.username, ''), split_part(p.email, '@', 1), 'Użytkownik') as username,
  p.public_slug,
  p.avatar_url,
  p.plan,
  p.subscription_status,
  coalesce(p.imported_total_tips, 0)::int as total_tips,
  coalesce(p.imported_won_tips, 0)::int as wins,
  coalesce(p.imported_lost_tips, 0)::int as losses,
  case
    when coalesce(p.imported_won_tips, 0) + coalesce(p.imported_lost_tips, 0) > 0
    then round((p.imported_won_tips::numeric / nullif(p.imported_won_tips + p.imported_lost_tips, 0)) * 100, 2)
    else 0
  end as winrate,
  coalesce(p.imported_yield, 0)::numeric as roi,
  coalesce(p.imported_profit, 0)::numeric as profit,
  coalesce(f.followers, 0)::int as followers
from public.profiles p
left join (
  select tipster_id, count(*)::int as followers
  from public.tipster_follows
  group by tipster_id
) f on f.tipster_id = p.id
order by coalesce(p.imported_profit, 0) desc, coalesce(p.imported_yield, 0) desc, coalesce(p.imported_total_tips, 0) desc;

select 'v999 live ranking, follows, challenge rewards ready' as status;
