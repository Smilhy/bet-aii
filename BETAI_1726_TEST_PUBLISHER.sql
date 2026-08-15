-- BETAI 1726 — kontrola po uruchomieniu publishera
-- 1) Ręcznie wejdź:
-- https://bet-ai.app/.netlify/functions/publish-betai-multisport-ai?limit=6&days=2
--
-- 2) Sprawdź najnowsze typy:
select
  id,
  author_name,
  username,
  match_name,
  prediction,
  odds,
  status,
  created_at,
  ai_source,
  tip_source
from public.tips
where author_name = 'BetAI MultiSport AI'
   or username = 'betai-multisport-ai'
   or author_name ilike '%BetAI%'
order by created_at desc
limit 20;
