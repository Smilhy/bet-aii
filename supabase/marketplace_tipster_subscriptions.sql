-- BetAI Marketplace v103
-- Tipster sam ustala ceny: pojedynczy typ + dostęp do profilu.
-- Platforma pobiera zawsze 20%, tipster dostaje 80%.

create table if not exists public.tipster_plans (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid references public.profiles(id) on delete cascade,
  plan_key text not null,
  label text not null,
  duration_days int not null,
  price numeric not null default 0,
  active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(tipster_id, plan_key)
);

create table if not exists public.tipster_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tipster_id uuid references public.profiles(id) on delete cascade,
  duration_days int not null,
  price numeric not null default 0,
  platform_fee numeric not null default 0,
  tipster_amount numeric not null default 0,
  stripe_session_id text unique,
  status text default 'active',
  expires_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(user_id, tipster_id)
);

create table if not exists public.tip_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tip_id uuid,
  tipster_id uuid references public.profiles(id) on delete set null,
  price numeric not null default 0,
  platform_fee numeric not null default 0,
  tipster_amount numeric not null default 0,
  stripe_session_id text unique,
  status text default 'paid',
  created_at timestamp default now()
);

create table if not exists public.earnings (
  id uuid default gen_random_uuid() primary key,
  tipster_id uuid references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  tip_id uuid,
  gross_amount numeric not null default 0,
  amount numeric not null default 0,
  commission numeric not null default 0,
  source text default 'tip_purchase',
  stripe_session_id text,
  status text default 'available',
  created_at timestamp default now()
);

-- Uzupełnienie istniejących tabel, jeśli były tworzone wcześniej w prostszej wersji.
alter table public.tip_purchases add column if not exists tipster_id uuid;
alter table public.tip_purchases add column if not exists platform_fee numeric not null default 0;
alter table public.tip_purchases add column if not exists tipster_amount numeric not null default 0;
alter table public.tip_purchases add column if not exists stripe_session_id text;
alter table public.tip_purchases add column if not exists status text default 'paid';

alter table public.earnings add column if not exists user_id uuid;
alter table public.earnings add column if not exists tip_id uuid;
alter table public.earnings add column if not exists gross_amount numeric not null default 0;
alter table public.earnings add column if not exists amount numeric not null default 0;
alter table public.earnings add column if not exists commission numeric not null default 0;
alter table public.earnings add column if not exists source text default 'tip_purchase';
alter table public.earnings add column if not exists stripe_session_id text;
alter table public.earnings add column if not exists status text default 'available';

create index if not exists idx_tipster_plans_tipster on public.tipster_plans(tipster_id);
create index if not exists idx_tipster_subscriptions_user on public.tipster_subscriptions(user_id);
create index if not exists idx_tipster_subscriptions_tipster on public.tipster_subscriptions(tipster_id);
create index if not exists idx_tip_purchases_user on public.tip_purchases(user_id);
create index if not exists idx_tip_purchases_tip on public.tip_purchases(tip_id);
create index if not exists idx_earnings_tipster on public.earnings(tipster_id);

-- Domyślne plany dla istniejących kont premium/tipsterów można tworzyć w UI.
