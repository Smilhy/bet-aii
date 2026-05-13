-- REAL RANKING TIPSTERÓW
-- Wklej w Supabase SQL Editor i uruchom raz.
-- Widok korzysta z realnych tabel: profiles, tips, earnings.

alter table tips
add column if not exists result text default 'pending';

alter table tips
drop constraint if exists tips_result_check;

alter table tips
add constraint tips_result_check
check (result in ('pending', 'win', 'won', 'loss', 'lost', 'lose', 'void'));

create or replace view tipster_stats as
select
  t.author_id as tipster_id,
  count(*)::int as total_tips,
  sum(case when lower(coalesce(t.result, t.status, 'pending')) in ('win', 'won') then 1 else 0 end)::int as wins,
  sum(case when lower(coalesce(t.result, t.status, 'pending')) in ('loss', 'lost', 'lose') then 1 else 0 end)::int as losses,
  round(
    case
      when count(*) = 0 then 0
      else (
        sum(case when lower(coalesce(t.result, t.status, 'pending')) in ('win', 'won') then 1 else 0 end)::numeric
        / nullif(count(*), 0)
      ) * 100
    end,
    2
  ) as winrate
from tips t
where t.author_id is not null
  and coalesce(t.author_name, '') <> 'AI Tip'
group by t.author_id;

create or replace view tipster_earnings_summary as
select
  e.tipster_id,
  coalesce(sum(e.amount), 0) as earnings,
  coalesce(sum(e.commission), 0) as platform_commission
from earnings e
where e.tipster_id is not null
group by e.tipster_id;

create or replace view tipster_ranking as
select
  p.id as tipster_id,
  p.email,
  coalesce(ts.total_tips, 0) as total_tips,
  coalesce(ts.wins, 0) as wins,
  coalesce(ts.losses, 0) as losses,
  coalesce(ts.winrate, 0) as winrate,
  coalesce(es.earnings, 0) as earnings,
  coalesce(es.platform_commission, 0) as platform_commission,
  round(
    case
      when coalesce(ts.total_tips, 0) = 0 then 0
      else coalesce(es.earnings, 0) / nullif(ts.total_tips, 0)
    end,
    2
  ) as roi
from profiles p
left join tipster_stats ts on ts.tipster_id = p.id
left join tipster_earnings_summary es on es.tipster_id = p.id
where coalesce(ts.total_tips, 0) > 0 or coalesce(es.earnings, 0) > 0
order by earnings desc, winrate desc, total_tips desc;
