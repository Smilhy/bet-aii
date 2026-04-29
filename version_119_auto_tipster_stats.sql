-- BetAI Marketplace Stripe Final Webhook Schema
-- Wklej CAŁOŚĆ w Supabase SQL Editor -> RUN

create table if not exists public.tip_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric,
  created_at timestamp default now()
);
alter table public.tip_purchases
  add column if not exists tipster_id uuid,
  add column if not exists platform_fee numeric default 0,
  add column if not exists tipster_amount numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'paid';
create index if not exists idx_tip_purchases_user on public.tip_purchases(user_id);
create index if not exists idx_tip_purchases_tip on public.tip_purchases(tip_id);
create index if not exists idx_tip_purchases_tipster on public.tip_purchases(tipster_id);
create unique index if not exists uniq_tip_purchases_stripe_session on public.tip_purchases(stripe_session_id) where stripe_session_id is not null;

create table if not exists public.unlocked_tips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric default 0,
  created_at timestamp default now()
);
alter table public.unlocked_tips add column if not exists stripe_session_id text;
create index if not exists idx_unlocked_tips_user on public.unlocked_tips(user_id);
create index if not exists idx_unlocked_tips_tip on public.unlocked_tips(tip_id);
create unique index if not exists uniq_unlocked_tips_user_tip on public.unlocked_tips(user_id, tip_id);

create table if not exists public.tipster_plans (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid references public.profiles(id) on delete cascade,
  price numeric,
  duration_days int,
  created_at timestamp default now()
);
alter table public.tipster_plans
  add column if not exists name text,
  add column if not exists plan_key text,
  add column if not exists label text,
  add column if not exists active boolean default true;
create index if not exists idx_tipster_plans_tipster on public.tipster_plans(tipster_id);
create unique index if not exists uniq_tipster_plans_tipster_key on public.tipster_plans(tipster_id, plan_key) where plan_key is not null;

create table if not exists public.tipster_subscriptions (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid references public.profiles(id) on delete cascade,
  created_at timestamp default now(),
  expires_at timestamp
);
alter table public.tipster_subscriptions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists buyer_id uuid references public.profiles(id) on delete cascade,
  add column if not exists plan text,
  add column if not exists plan_key text,
  add column if not exists duration_days int,
  add column if not exists price numeric default 0,
  add column if not exists platform_fee numeric default 0,
  add column if not exists tipster_amount numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'active';
update public.tipster_subscriptions set user_id = buyer_id where user_id is null and buyer_id is not null;
update public.tipster_subscriptions set buyer_id = user_id where buyer_id is null and user_id is not null;
create index if not exists idx_tipster_sub_tipster on public.tipster_subscriptions(tipster_id);
create index if not exists idx_tipster_sub_user on public.tipster_subscriptions(user_id);
create index if not exists idx_tipster_sub_buyer on public.tipster_subscriptions(buyer_id);
create unique index if not exists uniq_tipster_sub_user_tipster on public.tipster_subscriptions(user_id, tipster_id);
create unique index if not exists uniq_tipster_sub_stripe_session on public.tipster_subscriptions(stripe_session_id) where stripe_session_id is not null;

create table if not exists public.user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tipster_id uuid references public.profiles(id) on delete cascade,
  expires_at timestamp,
  created_at timestamp default now()
);
alter table public.user_subscriptions
  add column if not exists price numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'active';
create index if not exists idx_user_subscriptions_user on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_tipster on public.user_subscriptions(tipster_id);
create unique index if not exists uniq_user_subscriptions_user_tipster on public.user_subscriptions(user_id, tipster_id);

create table if not exists public.earnings (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid,
  amount numeric,
  commission numeric,
  created_at timestamp default now(),
  source text
);
alter table public.earnings
  add column if not exists user_id uuid,
  add column if not exists tip_id uuid,
  add column if not exists gross_amount numeric default 0,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'available';
create index if not exists idx_earnings_tipster on public.earnings(tipster_id);
create index if not exists idx_earnings_user on public.earnings(user_id);
create unique index if not exists uniq_earnings_stripe_source on public.earnings(stripe_session_id, source) where stripe_session_id is not null;

drop trigger if exists trigger_tip_purchase on public.tip_purchases;
drop trigger if exists trigger_tipster_subscription on public.tipster_subscriptions;

create or replace function public.has_access_to_tip(p_user uuid, p_tip uuid)
returns boolean
language plpgsql
as $$
declare
  tip_owner uuid;
  has_single_purchase boolean;
  has_subscription boolean;
begin
  select author_id into tip_owner from public.tips where id = p_tip;
  if tip_owner is null then return false; end if;

  select exists (select 1 from public.tip_purchases where user_id = p_user and tip_id = p_tip) into has_single_purchase;

  select exists (
    select 1 from public.tipster_subscriptions
    where (user_id = p_user or buyer_id = p_user)
      and tipster_id = tip_owner
      and coalesce(status, 'active') = 'active'
      and expires_at > now()
  ) into has_subscription;

  return has_single_purchase or has_subscription;
end;
$$;
