-- Bet+AI schema v20
-- UWAGA: jeśli masz już tabelę tips i dane testowe, ten skrypt zachowuje tabelę i dodaje brakujące kolumny.
-- Wklej w Supabase SQL Editor i kliknij RUN.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  role text not null default 'user' check (role in ('user', 'tipster', 'admin')),
  wallet numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles readable by owner" on public.profiles;
create policy "Profiles readable by owner"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Profiles insert owner" on public.profiles;
create policy "Profiles insert owner"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Profiles update owner" on public.profiles;
create policy "Profiles update owner"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'AdrianNowak',
  league text not null,
  team_home text not null,
  team_away text not null,
  match_time timestamptz,
  bet_type text not null,
  odds numeric(8,2) not null,
  analysis text,
  ai_probability int check (ai_probability >= 0 and ai_probability <= 100),
  access_type text not null default 'free' check (access_type in ('free', 'premium')),
  price numeric(8,2) default 0,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  tags text[] default '{}',
  notify_followers boolean default true
);

alter table public.tips add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.tips enable row level security;

drop policy if exists "Anyone can read tips" on public.tips;
create policy "Anyone can read tips"
on public.tips for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert tips" on public.tips;
create policy "Authenticated users can insert tips"
on public.tips for insert
to authenticated
with check (true);

drop policy if exists "Anyone can insert tips" on public.tips;
create policy "Anyone can insert tips"
on public.tips for insert
to anon, authenticated
with check (true);

create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips for insert
to authenticated
with check (auth.uid() = user_id);


-- Wersja 25 — historia płatności
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete set null,
  stripe_session_id text,
  amount numeric(10,2) not null default 0,
  currency text not null default 'pln',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
on public.payments for select
to authenticated
using (auth.uid() = user_id);

create index if not exists payments_user_id_created_at_idx
on public.payments(user_id, created_at desc);


-- Wersja 26 — payout requests dla tipsterów
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.payout_requests enable row level security;

drop policy if exists "Users read own payout requests" on public.payout_requests;
create policy "Users read own payout requests"
on public.payout_requests for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own payout requests" on public.payout_requests;
create policy "Users insert own payout requests"
on public.payout_requests for insert
to authenticated
with check (auth.uid() = user_id);


-- Wersja 27 — zapis płatności Stripe do Supabase
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete set null,
  stripe_session_id text,
  amount numeric(10,2) not null default 0,
  currency text not null default 'pln',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
on public.payments for select
to authenticated
using (auth.uid() = user_id);

create index if not exists payments_user_id_created_at_idx
on public.payments(user_id, created_at desc);

create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips for insert
to authenticated
with check (auth.uid() = user_id);


-- Wersja 28 — trwałe odblokowania premium po powrocie ze Stripe
create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own unlocked tips" on public.unlocked_tips;
create policy "Users update own unlocked tips"
on public.unlocked_tips for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- Wersja 29 — fix trwałego odblokowania po refreshu
create table if not exists public.unlocked_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete cascade,
  price numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  unique(user_id, tip_id)
);

alter table public.unlocked_tips enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own unlocked tips" on public.unlocked_tips;
create policy "Users update own unlocked tips"
on public.unlocked_tips for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- Wersja 32 — payments final policies
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tip_id uuid,
  stripe_session_id text,
  amount numeric(10,2) not null default 0,
  currency text not null default 'pln',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own payments" on public.payments;
create policy "Users insert own payments"
on public.payments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage payments" on public.payments;
create policy "Service role can manage payments"
on public.payments
for all
to service_role
using (true)
with check (true);

create index if not exists payments_user_id_created_at_idx
on public.payments(user_id, created_at desc);

create index if not exists payments_tip_id_idx
on public.payments(tip_id);


-- Wersja 34 — payment return fallback policies
alter table public.unlocked_tips enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Users insert own payments" on public.payments;
create policy "Users insert own payments"
on public.payments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own unlocked tips" on public.unlocked_tips;
create policy "Users update own unlocked tips"
on public.unlocked_tips
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- Wersja 37 — izolacja użytkowników
-- Każdy użytkownik widzi tylko swoje odblokowania i swoje płatności.
-- Tipy premium mogą być publicznie widoczne jako lista, ale treść premium odblokowuje tylko tabela unlocked_tips.

alter table if exists public.unlocked_tips enable row level security;
alter table if exists public.payments enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked tips" on public.unlocked_tips;
create policy "Users insert own unlocked tips"
on public.unlocked_tips
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own unlocked tips" on public.unlocked_tips;
create policy "Users update own unlocked tips"
on public.unlocked_tips
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own payments" on public.payments;
create policy "Users insert own payments"
on public.payments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage payments" on public.payments;
create policy "Service role can manage payments"
on public.payments
for all
to service_role
using (true)
with check (true);

-- Ważne: jeśli wcześniej były szerokie polityki, usuń je ręcznie w Supabase, jeśli mają inne nazwy.


-- Wersja 43 — widoczność typów per user
-- Tipy mają autora. Aplikacja pokazuje: moje + darmowe + kupione.
alter table if exists public.tips add column if not exists author_id uuid;
alter table if exists public.tips add column if not exists user_id uuid;
alter table if exists public.tips add column if not exists author_email text;

-- Dane zakupów zostają odizolowane per użytkownik.
alter table if exists public.unlocked_tips enable row level security;
alter table if exists public.payments enable row level security;

drop policy if exists "Users read own unlocked tips" on public.unlocked_tips;
create policy "Users read own unlocked tips"
on public.unlocked_tips
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);


-- Wersja 44 — profile tipstera
create table if not exists public.tipster_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text,
  bio text,
  role text not null default 'user',
  is_tipster boolean default false,
  created_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.tipster_profiles enable row level security;

drop policy if exists "Users read own tipster profile" on public.tipster_profiles;
create policy "Users read own tipster profile"
on public.tipster_profiles for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users insert own tipster profile" on public.tipster_profiles;
create policy "Users insert own tipster profile"
on public.tipster_profiles for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own tipster profile" on public.tipster_profiles;
create policy "Users update own tipster profile"
on public.tipster_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
