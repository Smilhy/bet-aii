-- Wersja 118 — Tipster Profile PRO (sales upgrade)
-- Bezpieczny patch: tworzy/rozszerza tipster_profiles i odświeża widok rankingowy o social proof.

create table if not exists public.tipster_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  bio text,
  avatar_url text,
  role text not null default 'user',
  is_tipster boolean default false,
  buyers_count integer default 0,
  sales_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tipster_profiles add column if not exists avatar_url text;
alter table public.tipster_profiles add column if not exists buyers_count integer default 0;
alter table public.tipster_profiles add column if not exists sales_count integer default 0;
alter table public.tipster_profiles add column if not exists updated_at timestamptz not null default now();

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

-- Social proof z realnych zakupów: pojedyncze typy + dostęp do profilu.
drop view if exists public.tipster_ranking;
create view public.tipster_ranking as
select
  p.id as tipster_id,
  p.email,
  count(distinct t.id) as total_tips,
  sum(case when t.result = 'win' then 1 else 0 end) as wins,
  sum(case when t.result = 'loss' then 1 else 0 end) as losses,
  round(
    case when sum(case when t.result in ('win','loss') then 1 else 0 end) = 0 then 0
    else (sum(case when t.result = 'win' then 1 else 0 end)::numeric / nullif(sum(case when t.result in ('win','loss') then 1 else 0 end),0)) * 100 end,
    2
  ) as winrate,
  coalesce(sum(distinct e.amount), 0) as earnings,
  round(coalesce(sum(distinct e.amount), 0) / nullif(count(distinct t.id), 0), 2) as roi,
  coalesce(tp.sales_count, 0) as profile_sales_count,
  coalesce(tp.buyers_count, 0) as profile_buyers_count,
  (
    select count(*) from public.tip_purchases x where x.tipster_id = p.id
  ) + (
    select count(*) from public.tipster_subscriptions s where s.tipster_id = p.id and coalesce(s.status, 'active') = 'active'
  ) + coalesce(tp.sales_count, 0) as sales_count,
  (
    select count(distinct x.user_id) from public.tip_purchases x where x.tipster_id = p.id
  ) + (
    select count(distinct coalesce(s.user_id, s.buyer_id)) from public.tipster_subscriptions s where s.tipster_id = p.id and coalesce(s.status, 'active') = 'active'
  ) + coalesce(tp.buyers_count, 0) as buyers_count,
  0::numeric as roi_7d,
  round(coalesce(sum(distinct e.amount), 0) / nullif(count(distinct t.id), 0), 2) as roi_30d
from public.profiles p
left join public.tips t on t.author_id = p.id
left join public.earnings e on e.tipster_id = p.id
left join public.tipster_profiles tp on tp.user_id = p.id
group by p.id, p.email, tp.sales_count, tp.buyers_count;
