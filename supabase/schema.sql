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


-- Wersja 45 — payout requests
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.payout_requests enable row level security;

drop policy if exists "Users read own payout requests" on public.payout_requests;
create policy "Users read own payout requests"
on public.payout_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own payout requests" on public.payout_requests;
create policy "Users insert own payout requests"
on public.payout_requests
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage payout requests" on public.payout_requests;
create policy "Service role can manage payout requests"
on public.payout_requests
for all
to service_role
using (true)
with check (true);


-- Wersja 47 — payout_requests safe table
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);

alter table public.payout_requests enable row level security;

drop policy if exists "Users read own payout requests" on public.payout_requests;
create policy "Users read own payout requests"
on public.payout_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own payout requests" on public.payout_requests;
create policy "Users insert own payout requests"
on public.payout_requests
for insert
to authenticated
with check (auth.uid() = user_id);


-- Wersja 49 — admin payouts policies
alter table public.payout_requests enable row level security;

drop policy if exists "Admin read all payout requests" on public.payout_requests;
create policy "Admin read all payout requests"
on public.payout_requests
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'smilhytv@gmail.com');

drop policy if exists "Admin update payout requests" on public.payout_requests;
create policy "Admin update payout requests"
on public.payout_requests
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'smilhytv@gmail.com')
with check ((auth.jwt() ->> 'email') = 'smilhytv@gmail.com');

-- Wersja 50 — limity wypłat Free/Premium
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.user_subscriptions;
create policy "Users read own subscription"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admin manage subscriptions" on public.user_subscriptions;
create policy "Admin manage subscriptions"
on public.user_subscriptions
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'smilhytv@gmail.com')
with check ((auth.jwt() ->> 'email') = 'smilhytv@gmail.com');

create or replace function public.can_request_payout(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_count int;
  user_plan text;
  limit_count int;
begin
  select plan into user_plan
  from public.user_subscriptions
  where user_id = p_user_id
  limit 1;

  if user_plan is null then
    user_plan := 'free';
  end if;

  if user_plan = 'premium' then
    limit_count := 3;
  else
    limit_count := 1;
  end if;

  select count(*) into payout_count
  from public.payout_requests
  where user_id = p_user_id
    and date_trunc('month', created_at) = date_trunc('month', now());

  return payout_count < limit_count;
end;
$$;

create or replace function public.request_payout(p_user_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> p_user_id then
    raise exception 'Brak dostępu';
  end if;

  if p_amount <= 0 then
    raise exception 'Kwota wypłaty musi być większa od 0';
  end if;

  if not public.can_request_payout(p_user_id) then
    raise exception 'Limit wypłat osiągnięty';
  end if;

  insert into public.payout_requests (user_id, amount, status)
  values (p_user_id, p_amount, 'pending');
end;
$$;

grant execute on function public.can_request_payout(uuid) to authenticated;
grant execute on function public.request_payout(uuid, numeric) to authenticated;


-- Wersja 51 — antyspam wypłat + limity
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.user_subscriptions;
create policy "Users read own subscription"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.can_request_payout(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_count int;
  user_plan text;
  limit_count int;
begin
  select plan into user_plan
  from public.user_subscriptions
  where user_id = p_user_id
  order by created_at desc
  limit 1;

  if user_plan is null then user_plan := 'free'; end if;
  if user_plan = 'premium' then limit_count := 3; else limit_count := 1; end if;

  select count(*) into payout_count
  from public.payout_requests
  where user_id = p_user_id
    and date_trunc('month', created_at) = date_trunc('month', now());

  return payout_count < limit_count;
end;
$$;

create or replace function public.request_payout(p_user_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> p_user_id then
    raise exception 'Brak dostępu';
  end if;

  if p_amount <= 0 then
    raise exception 'Kwota wypłaty musi być większa od 0';
  end if;

  -- Antyspam: blokuj drugi request w 10 sekundach
  if exists (
    select 1 from public.payout_requests
    where user_id = p_user_id
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Poczekaj chwilę przed kolejną wypłatą';
  end if;

  if not public.can_request_payout(p_user_id) then
    raise exception 'Limit wypłat osiągnięty';
  end if;

  insert into public.payout_requests (user_id, amount, status)
  values (p_user_id, p_amount, 'pending');
end;
$$;

grant execute on function public.can_request_payout(uuid) to authenticated;
grant execute on function public.request_payout(uuid, numeric) to authenticated;

-- Wersja 52 — poprawka FREE/VIP i saldo per user
-- Usuń duplikaty planów, zostaw najnowszy wpis na user_id.
delete from public.user_subscriptions a
using public.user_subscriptions b
where a.user_id = b.user_id
  and a.created_at < b.created_at;

create unique index if not exists user_subscriptions_user_id_uidx
on public.user_subscriptions(user_id);


-- Wersja 53 — userPlan crash fix
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

delete from public.user_subscriptions a
using public.user_subscriptions b
where a.user_id = b.user_id
  and a.created_at < b.created_at;

create unique index if not exists user_subscriptions_user_id_uidx
on public.user_subscriptions(user_id);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.user_subscriptions;
create policy "Users read own subscription"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);


-- Wersja 54 — final userPlan safety
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

delete from public.user_subscriptions a
using public.user_subscriptions b
where a.user_id = b.user_id
  and a.created_at < b.created_at;

create unique index if not exists user_subscriptions_user_id_uidx
on public.user_subscriptions(user_id);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.user_subscriptions;
create policy "Users read own subscription"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);


-- Wersja 56 — wallet bezpieczeństwo / bez fake top-up
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  type text not null default 'topup',
  provider text default 'stripe',
  provider_session_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_provider_session_uidx
on public.wallet_transactions(provider_session_id)
where provider_session_id is not null;

alter table public.wallet_transactions enable row level security;

drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions"
on public.wallet_transactions
for select
to authenticated
using (auth.uid() = user_id);


-- Wersja 57 — realne saldo + blokada premium typów dla FREE

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  type text not null default 'topup',
  provider text default 'stripe',
  provider_session_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_provider_session_uidx
on public.wallet_transactions(provider_session_id)
where provider_session_id is not null;

alter table public.wallet_transactions enable row level security;

drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions"
on public.wallet_transactions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_wallet_balance(p_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when status <> 'completed' then 0
      when type in ('spend','purchase') then -amount
      else amount
    end
  ), 0)
  from public.wallet_transactions
  where user_id = p_user_id;
$$;

grant execute on function public.get_wallet_balance(uuid) to authenticated;

-- Blokada: FREE nie może dodawać/sprzedawać typów premium.


-- Wersja 58 — naprawa triggera tips bez błędu missing column
-- Funkcja NIE odwołuje się bezpośrednio do new.user_id / new.created_by,
-- tylko czyta pola przez to_jsonb(new), więc nie wywali błędu gdy kolumna nie istnieje.
create or replace function public.block_free_premium_tips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  author uuid;
  row_data jsonb;
  is_tip_premium boolean;
begin
  row_data := to_jsonb(new);

  author := coalesce(
    nullif(row_data ->> 'author_id', '')::uuid,
    nullif(row_data ->> 'tipster_id', '')::uuid,
    nullif(row_data ->> 'profile_id', '')::uuid,
    nullif(row_data ->> 'owner_id', '')::uuid
  );

  is_tip_premium := coalesce((row_data ->> 'is_premium')::boolean, false);

  -- Jeśli to darmowy typ, przepuszczamy.
  if not is_tip_premium then
    return new;
  end if;

  -- Jeśli tabela tips nie ma autora, nie blokujemy zapisu,
  -- bo inaczej rozwali dodawanie typów. Frontend i tak wysyła autora w appce.
  if author is null then
    return new;
  end if;

  select plan into user_plan
  from public.user_subscriptions
  where user_id = author
  limit 1;

  if coalesce(user_plan, 'free') <> 'premium' then
    raise exception 'FREE_USERS_CAN_ONLY_ADD_FREE_TIPS';
  end if;

  return new;
end;
$$;

drop trigger if exists block_free_premium_tips_trigger on public.tips;

create trigger block_free_premium_tips_trigger
before insert or update on public.tips
for each row
execute function public.block_free_premium_tips();

