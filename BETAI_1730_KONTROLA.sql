select
  id,
  author_name,
  username,
  match_name,
  prediction,
  odds,
  status,
  created_at,
  tip_source
from public.tips
where author_name = 'BetAI MultiSport AI'
   or username = 'betai-multisport-ai'
   or tip_source = 'betai-multisport-ai-only-publisher-v1730'
order by created_at desc
limit 20;
