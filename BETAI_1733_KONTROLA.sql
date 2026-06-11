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
  access_type,
  is_premium,
  match_time,
  created_at,
  tip_source,
  source,
  ai_source
from public.tips
where author_name = 'BetAI MultiSport AI'
order by created_at desc
limit 30;
