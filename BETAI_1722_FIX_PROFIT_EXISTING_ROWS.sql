-- BETAI 1722 — jednorazowe domknięcie profitu dla już rozliczonych typów betai-multisport-ai
update public.tips
set
  result = status,
  settlement_status = status,
  profit = case
    when status = 'won' then round((coalesce(stake, 0) * (coalesce(odds, 0) - 1))::numeric, 2)
    when status = 'lost' then -coalesce(stake, 0)
    when status = 'void' then 0
    else profit
  end,
  updated_at = now()
where (
    username = 'betai-multisport-ai'
    or author_name = 'betai-multisport-ai'
    or author_name ilike '%BetAI%'
  )
  and status in ('won', 'lost', 'void');

-- kontrola
select
  match_name,
  odds,
  stake,
  status,
  result,
  settlement_status,
  profit
from public.tips
where username = 'betai-multisport-ai'
   or author_name = 'betai-multisport-ai'
   or author_name ilike '%BetAI%'
order by created_at desc
limit 30;
