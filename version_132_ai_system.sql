-- Wersja 119 — AUTO LICZENIE STATYSTYK TIPSTERA
-- Uruchom w Supabase SQL Editor po wersji 118.
-- Cel: ROI / winrate / licznik typów / premium / sprzedaży / kupujących liczone automatycznie z bazy.

-- 1) Bezpieczne kolumny wymagane przez statystyki.
alter table if exists public.tips add column if not exists result text default 'pending';
alter table if exists public.tips add column if not exists is_premium boolean default false;
alter table if exists public.tips add column if not exists price numeric default 0;

alter table if exists public.tips drop constraint if exists tips_result_check;
alter table if exists public.tips add constraint tips_result_check
check (coalesce(result, 'pending') in ('pending', 'win', 'loss', 'void'));

create table if not exists public.tipster_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  bio text,
  avatar_url text,
  role text not null default 'user',
  is_tipster boolean default false,
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

alter table public.tipster_profiles add column if not exists roi_7d numeric default 0;
alter table public.tipster_profiles add column if not exists roi_30d numeric default 0;
alter table public.tipster_profiles add column if not exists winrate numeric default 0;
alter table public.tipster_profiles add column if not exists total_tips integer default 0;
alter table public.tipster_profiles add column if not exists premium_tips integer default 0;
alter table public.tipster_profiles add column if not exists buyers_count integer default 0;
alter table public.tipster_profiles add column if not exists sales_count integer default 0;
alter table public.tipster_profiles add column if not exists total_earnings numeric default 0;
alter table public.tipster_profiles add column if not exists updated_at timestamptz not null default now();

alter table public.tipster_profiles enable row level security;

drop policy if exists "tipster_profiles_select_public" on public.tipster_profiles;
drop policy if exists "tipster_profiles_select" on public.tipster_profiles;
drop policy if exists "tipster_profiles_insert_own" on public.tipster_profiles;
drop policy if exists "tipster_profiles_update_own" on public.tipster_profiles;

create policy "tipster_profiles_select_public"
on public.tipster_profiles
for select
using (true);

create policy "tipster_profiles_insert_own"
on public.tipster_profiles
for insert
with check (auth.uid() = user_id);

create policy "tipster_profiles_update_own"
on public.tipster_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 2) Widoki statystyczne bez duplikowania sum przez joiny.
drop view if exists public.stats_overview cascade;
drop view if exists public.stats_recent_form cascade;
drop view if exists public.stats_by_league cascade;
drop view if exists public.stats_by_type cascade;
drop view if exists public.stats_distribution cascade;
drop view if exists public.tipster_ranking cascade;

create view public.stats_overview as
select
  t.author_id as tipster_id,
  count(*)::int as total_tips,
  sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::int as wins,
  sum(case when coalesce(t.result,'pending') = 'loss' then 1 else 0 end)::int as losses,
  sum(case when coalesce(t.result,'pending') = 'void' then 1 else 0 end)::int as voids,
  sum(case when coalesce(t.is_premium,false) = true or coalesce(t.access_type,'') = 'premium' or coalesce(t.price,0) > 0 then 1 else 0 end)::int as premium_tips,
  round(
    case when sum(case when coalesce(t.result,'pending') in ('win','loss') then 1 else 0 end) = 0 then 0
    else (sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::numeric / nullif(sum(case when coalesce(t.result,'pending') in ('win','loss') then 1 else 0 end),0)) * 100 end,
    2
  ) as winrate
from public.tips t
where t.author_id is not null
group by t.author_id;

create view public.stats_recent_form as
select
  t.id,
  t.author_id as tipster_id,
  coalesce(t.result,'pending') as result,
  t.status,
  t.created_at
from public.tips t
where t.author_id is not null
order by t.created_at desc;

create view public.stats_by_league as
select
  t.author_id as tipster_id,
  coalesce(t.league, 'Inne') as league,
  count(*)::int as bets,
  sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::int as wins,
  round(
    coalesce((sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::numeric / nullif(sum(case when coalesce(t.result,'pending') in ('win','loss') then 1 else 0 end),0)) * 100, 0),
    2
  ) as hit_rate,
  0::numeric as roi
from public.tips t
where t.author_id is not null
group by t.author_id, coalesce(t.league, 'Inne');

create view public.stats_by_type as
select
  t.author_id as tipster_id,
  coalesce(t.bet_type, 'Inne') as bet_type,
  count(*)::int as bets,
  sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::int as wins,
  round(
    coalesce((sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::numeric / nullif(sum(case when coalesce(t.result,'pending') in ('win','loss') then 1 else 0 end),0)) * 100, 0),
    2
  ) as hit_rate,
  0::numeric as roi
from public.tips t
where t.author_id is not null
group by t.author_id, coalesce(t.bet_type, 'Inne');

create view public.stats_distribution as
select
  t.author_id as tipster_id,
  sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::int as wins,
  sum(case when coalesce(t.result,'pending') = 'loss' then 1 else 0 end)::int as losses,
  sum(case when coalesce(t.result,'pending') = 'void' then 1 else 0 end)::int as voids
from public.tips t
where t.author_id is not null
group by t.author_id;

create view public.tipster_ranking as
with tip_stats as (
  select
    t.author_id as tipster_id,
    count(*)::int as total_tips,
    sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::int as wins,
    sum(case when coalesce(t.result,'pending') = 'loss' then 1 else 0 end)::int as losses,
    sum(case when coalesce(t.is_premium,false) = true or coalesce(t.access_type,'') = 'premium' or coalesce(t.price,0) > 0 then 1 else 0 end)::int as premium_tips,
    round(
      case when sum(case when coalesce(t.result,'pending') in ('win','loss') then 1 else 0 end) = 0 then 0
      else (sum(case when coalesce(t.result,'pending') = 'win' then 1 else 0 end)::numeric / nullif(sum(case when coalesce(t.result,'pending') in ('win','loss') then 1 else 0 end),0)) * 100 end,
      2
    ) as winrate
  from public.tips t
  where t.author_id is not null
  group by t.author_id
), earnings_stats as (
  select
    e.tipster_id,
    coalesce(sum(e.amount),0) as earnings,
    coalesce(sum(e.amount) filter (where e.created_at >= now() - interval '7 days'),0) as roi_7d,
    coalesce(sum(e.amount) filter (where e.created_at >= now() - interval '30 days'),0) as roi_30d
  from public.earnings e
  where e.tipster_id is not null
  group by e.tipster_id
), purchase_sales as (
  select
    x.tipster_id,
    count(*)::int as sales_count,
    count(distinct x.user_id)::int as buyers_count
  from public.tip_purchases x
  where x.tipster_id is not null
  group by x.tipster_id
), sub_sales as (
  select
    s.tipster_id,
    count(*)::int as sales_count,
    count(distinct coalesce(s.user_id, s.buyer_id))::int as buyers_count
  from public.tipster_subscriptions s
  where s.tipster_id is not null and coalesce(s.status, 'active') in ('active','paid','completed')
  group by s.tipster_id
)
select
  p.id as tipster_id,
  p.email,
  coalesce(ts.total_tips,0) as total_tips,
  coalesce(ts.premium_tips,0) as premium_tips,
  coalesce(ts.wins,0) as wins,
  coalesce(ts.losses,0) as losses,
  coalesce(ts.winrate,0) as winrate,
  coalesce(es.earnings,0) as earnings,
  coalesce(es.earnings,0) as total_earnings,
  round(coalesce(es.earnings,0) / nullif(coalesce(ts.total_tips,0),0), 2) as roi,
  coalesce(es.roi_7d,0) as roi_7d,
  coalesce(es.roi_30d,0) as roi_30d,
  (coalesce(ps.sales_count,0) + coalesce(ss.sales_count,0) + coalesce(tp.sales_count,0))::int as sales_count,
  (coalesce(ps.buyers_count,0) + coalesce(ss.buyers_count,0) + coalesce(tp.buyers_count,0))::int as buyers_count
from public.profiles p
left join tip_stats ts on ts.tipster_id = p.id
left join earnings_stats es on es.tipster_id = p.id
left join purchase_sales ps on ps.tipster_id = p.id
left join sub_sales ss on ss.tipster_id = p.id
left join public.tipster_profiles tp on tp.user_id = p.id
where coalesce(ts.total_tips,0) > 0 or coalesce(es.earnings,0) > 0 or coalesce(ps.sales_count,0) > 0 or coalesce(ss.sales_count,0) > 0;

-- 3) Funkcja przeliczenia cache w tipster_profiles. Frontend używa widoku, ale cache pomaga w panelach i przyszłych funkcjach.
create or replace function public.refresh_tipster_profile_stats(p_tipster_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipster_id is null then
    return;
  end if;

  insert into public.tipster_profiles (
    user_id, is_tipster, total_tips, premium_tips, winrate, roi_7d, roi_30d, buyers_count, sales_count, total_earnings, updated_at
  )
  select
    r.tipster_id,
    true,
    coalesce(r.total_tips,0),
    coalesce(r.premium_tips,0),
    coalesce(r.winrate,0),
    coalesce(r.roi_7d,0),
    coalesce(r.roi_30d,0),
    coalesce(r.buyers_count,0),
    coalesce(r.sales_count,0),
    coalesce(r.earnings,0),
    now()
  from public.tipster_ranking r
  where r.tipster_id = p_tipster_id
  on conflict (user_id) do update set
    is_tipster = true,
    total_tips = excluded.total_tips,
    premium_tips = excluded.premium_tips,
    winrate = excluded.winrate,
    roi_7d = excluded.roi_7d,
    roi_30d = excluded.roi_30d,
    buyers_count = excluded.buyers_count,
    sales_count = excluded.sales_count,
    total_earnings = excluded.total_earnings,
    updated_at = now();
end;
$$;

create or replace function public.refresh_all_tipster_profile_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select tipster_id from public.tipster_ranking loop
    perform public.refresh_tipster_profile_stats(r.tipster_id);
  end loop;
end;
$$;

grant execute on function public.refresh_tipster_profile_stats(uuid) to authenticated;
grant execute on function public.refresh_all_tipster_profile_stats() to authenticated;

-- Jednorazowe przeliczenie po uruchomieniu patcha.
select public.refresh_all_tipster_profile_stats();
