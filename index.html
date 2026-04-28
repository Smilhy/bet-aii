-- Wersja 120 — LIVE STATS + TOP TIPSTERS
-- Realny ranking z Supabase: ROI, top sprzedaż, top winrate.
-- Uruchom w Supabase SQL Editor po wersji 119.

alter table if exists public.tips add column if not exists result text default 'pending';
alter table if exists public.tips add column if not exists odds numeric default 0;
alter table if exists public.tips add column if not exists is_premium boolean default false;
alter table if exists public.tips add column if not exists access_type text default 'free';

alter table if exists public.tips drop constraint if exists tips_result_check;
alter table if exists public.tips add constraint tips_result_check
check (lower(coalesce(result, 'pending')) in ('pending', 'win', 'won', 'loss', 'lost', 'lose', 'void'));

create table if not exists public.tipster_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  bio text,
  avatar_url text,
  roi_7d numeric default 0,
  roi_30d numeric default 0,
  winrate numeric default 0,
  total_tips integer default 0,
  premium_tips integer default 0,
  buyers_count integer default 0,
  sales_count integer default 0,
  total_earnings numeric default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.tipster_profiles add column if not exists display_name text;
alter table public.tipster_profiles add column if not exists roi_7d numeric default 0;
alter table public.tipster_profiles add column if not exists roi_30d numeric default 0;
alter table public.tipster_profiles add column if not exists winrate numeric default 0;
alter table public.tipster_profiles add column if not exists total_tips integer default 0;
alter table public.tipster_profiles add column if not exists premium_tips integer default 0;
alter table public.tipster_profiles add column if not exists buyers_count integer default 0;
alter table public.tipster_profiles add column if not exists sales_count integer default 0;
alter table public.tipster_profiles add column if not exists total_earnings numeric default 0;
alter table public.tipster_profiles add column if not exists updated_at timestamptz default now();

create unique index if not exists tipster_profiles_user_id_unique on public.tipster_profiles(user_id);

create or replace view public.tipster_stats_live as
select
  t.author_id as tipster_id,
  count(*)::int as total_tips,
  sum(case when coalesce(t.is_premium, false) = true or lower(coalesce(t.access_type, 'free')) = 'premium' then 1 else 0 end)::int as premium_tips,
  sum(case when lower(coalesce(t.result, 'pending')) in ('win', 'won') then 1 else 0 end)::int as wins,
  sum(case when lower(coalesce(t.result, 'pending')) in ('loss', 'lost', 'lose') then 1 else 0 end)::int as losses,
  round(
    case
      when sum(case when lower(coalesce(t.result, 'pending')) in ('win', 'won', 'loss', 'lost', 'lose') then 1 else 0 end) = 0 then 0
      else (
        sum(case when lower(coalesce(t.result, 'pending')) in ('win', 'won') then 1 else 0 end)::numeric
        / nullif(sum(case when lower(coalesce(t.result, 'pending')) in ('win', 'won', 'loss', 'lost', 'lose') then 1 else 0 end), 0)
      ) * 100
    end,
    2
  ) as winrate,
  round(coalesce(sum(
    case
      when lower(coalesce(t.result, 'pending')) in ('win', 'won') then greatest(coalesce(t.odds, 0) - 1, 0)
      when lower(coalesce(t.result, 'pending')) in ('loss', 'lost', 'lose') then -1
      else 0
    end
  ), 0) * 100, 2) as roi
from public.tips t
where t.author_id is not null
group by t.author_id;

create or replace view public.tipster_sales_live as
select
  x.tipster_id,
  count(*)::int as total_sales,
  count(distinct x.user_id)::int as buyers_count,
  coalesce(sum(x.gross_amount), 0)::numeric as gross_sales,
  coalesce(sum(x.tipster_amount), 0)::numeric as earnings,
  coalesce(sum(x.platform_fee), 0)::numeric as platform_commission
from (
  select
    tp.tipster_id,
    tp.user_id,
    coalesce(tp.price, 0) as gross_amount,
    coalesce(tp.tipster_amount, coalesce(tp.price, 0) * 0.80) as tipster_amount,
    coalesce(tp.platform_fee, coalesce(tp.price, 0) * 0.20) as platform_fee
  from public.tip_purchases tp
  where tp.tipster_id is not null and coalesce(tp.status, 'paid') in ('paid', 'active', 'completed')

  union all

  select
    ts.tipster_id,
    ts.user_id,
    coalesce(ts.price, 0) as gross_amount,
    coalesce(ts.tipster_amount, coalesce(ts.price, 0) * 0.80) as tipster_amount,
    coalesce(ts.platform_fee, coalesce(ts.price, 0) * 0.20) as platform_fee
  from public.tipster_subscriptions ts
  where ts.tipster_id is not null and coalesce(ts.status, 'active') in ('active', 'paid', 'completed')
) x
group by x.tipster_id;

create or replace view public.tipster_ranking as
select
  coalesce(p.id, tp.user_id, st.tipster_id, sl.tipster_id) as tipster_id,
  coalesce(tp.display_name, p.email, 'Tipster') as display_name,
  p.email,
  coalesce(st.total_tips, tp.total_tips, 0)::int as total_tips,
  coalesce(st.premium_tips, tp.premium_tips, 0)::int as premium_tips,
  coalesce(st.wins, 0)::int as wins,
  coalesce(st.losses, 0)::int as losses,
  coalesce(st.winrate, tp.winrate, 0)::numeric as winrate,
  coalesce(st.roi, tp.roi_30d, 0)::numeric as roi,
  coalesce(sl.total_sales, tp.sales_count, 0)::int as total_sales,
  coalesce(sl.buyers_count, tp.buyers_count, 0)::int as buyers_count,
  coalesce(sl.gross_sales, 0)::numeric as gross_sales,
  coalesce(sl.earnings, tp.total_earnings, 0)::numeric as earnings,
  coalesce(sl.platform_commission, 0)::numeric as platform_commission,
  case
    when coalesce(sl.total_sales, tp.sales_count, 0) >= 10 then 'TOP SELLER'
    when coalesce(st.roi, tp.roi_30d, 0) > 0 then 'ROI PRO'
    when coalesce(st.winrate, tp.winrate, 0) >= 60 then 'HIGH WINRATE'
    else 'LIVE'
  end as badge
from public.profiles p
full join public.tipster_profiles tp on tp.user_id = p.id
full join public.tipster_stats_live st on st.tipster_id = coalesce(p.id, tp.user_id)
full join public.tipster_sales_live sl on sl.tipster_id = coalesce(p.id, tp.user_id, st.tipster_id)
where coalesce(st.total_tips, tp.total_tips, 0) > 0
   or coalesce(sl.total_sales, tp.sales_count, 0) > 0
order by roi desc, earnings desc, winrate desc, total_tips desc;

grant select on public.tipster_stats_live to anon, authenticated;
grant select on public.tipster_sales_live to anon, authenticated;
grant select on public.tipster_ranking to anon, authenticated;

insert into public.tipster_profiles (
  user_id,
  display_name,
  total_tips,
  premium_tips,
  winrate,
  roi_30d,
  sales_count,
  buyers_count,
  total_earnings,
  updated_at
)
select
  r.tipster_id,
  r.display_name,
  r.total_tips,
  r.premium_tips,
  r.winrate,
  r.roi,
  r.total_sales,
  r.buyers_count,
  r.earnings,
  now()
from public.tipster_ranking r
where r.tipster_id is not null
on conflict (user_id) do update
set
  display_name = coalesce(excluded.display_name, public.tipster_profiles.display_name),
  total_tips = excluded.total_tips,
  premium_tips = excluded.premium_tips,
  winrate = excluded.winrate,
  roi_30d = excluded.roi_30d,
  sales_count = excluded.sales_count,
  buyers_count = excluded.buyers_count,
  total_earnings = excluded.total_earnings,
  updated_at = now();
