select
  id,
  author_name,
  username,
  user_id,
  match_name,
  prediction,
  odds,
  status,
  result,
  result_status,
  settlement_status,
  access_type,
  is_premium,
  created_at,
  tip_source,
  source
from public.tips
where author_name = 'BetAI MultiSport AI'
order by created_at desc
limit 30;
