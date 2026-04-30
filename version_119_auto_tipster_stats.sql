-- v117 Profil tipstera + statystyki PRO
-- Wklej tylko jeśli nie masz jeszcze widoków stats_* albo chcesz je poprawić pod kolumnę result.

alter table tips
add column if not exists result text default 'pending';

alter table tips
drop constraint if exists tips_result_check;

alter table tips
add constraint tips_result_check
check (result in ('pending', 'win', 'loss', 'void'));

drop view if exists stats_overview;
create view stats_overview as
select
  author_id as tipster_id,
  count(*) as total_tips,
  sum(case when result = 'win' then 1 else 0 end) as wins,
  sum(case when result = 'loss' then 1 else 0 end) as losses,
  sum(case when result = 'void' then 1 else 0 end) as voids,
  round(
    case when sum(case when result in ('win','loss') then 1 else 0 end) = 0 then 0
    else (sum(case when result = 'win' then 1 else 0 end)::numeric / nullif(sum(case when result in ('win','loss') then 1 else 0 end),0)) * 100 end,
    2
  ) as winrate
from tips
group by author_id;

drop view if exists stats_recent_form;
create view stats_recent_form as
select
  id,
  author_id as tipster_id,
  result,
  status,
  created_at
from tips
where result in ('win','loss','void','pending')
order by created_at desc;

drop view if exists stats_by_league;
create view stats_by_league as
select
  author_id as tipster_id,
  league,
  count(*) as bets,
  sum(case when result = 'win' then 1 else 0 end) as wins,
  round((sum(case when result = 'win' then 1 else 0 end)::numeric / nullif(sum(case when result in ('win','loss') then 1 else 0 end),0)) * 100, 2) as hit_rate,
  0::numeric as roi
from tips
where league is not null
group by author_id, league;

drop view if exists stats_by_type;
create view stats_by_type as
select
  author_id as tipster_id,
  bet_type,
  count(*) as bets,
  sum(case when result = 'win' then 1 else 0 end) as wins,
  round((sum(case when result = 'win' then 1 else 0 end)::numeric / nullif(sum(case when result in ('win','loss') then 1 else 0 end),0)) * 100, 2) as hit_rate,
  0::numeric as roi
from tips
where bet_type is not null
group by author_id, bet_type;

drop view if exists stats_distribution;
create view stats_distribution as
select
  author_id as tipster_id,
  sum(case when result = 'win' then 1 else 0 end) as wins,
  sum(case when result = 'loss' then 1 else 0 end) as losses,
  sum(case when result = 'void' then 1 else 0 end) as voids
from tips
group by author_id;

drop view if exists tipster_ranking;
create view tipster_ranking as
select
  p.id as tipster_id,
  p.email,
  count(t.id) as total_tips,
  sum(case when t.result = 'win' then 1 else 0 end) as wins,
  sum(case when t.result = 'loss' then 1 else 0 end) as losses,
  round(
    case when sum(case when t.result in ('win','loss') then 1 else 0 end) = 0 then 0
    else (sum(case when t.result = 'win' then 1 else 0 end)::numeric / nullif(sum(case when t.result in ('win','loss') then 1 else 0 end),0)) * 100 end,
    2
  ) as winrate,
  coalesce(sum(e.amount), 0) as earnings,
  round(coalesce(sum(e.amount), 0) / nullif(count(t.id), 0), 2) as roi
from profiles p
left join tips t on t.author_id = p.id
left join earnings e on e.tipster_id = p.id
group by p.id, p.email;
