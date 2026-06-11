-- BETAI 1723 — kontrola pendingów betai-multisport-ai po deployu
-- 1) Wejdź w:
-- https://bet-ai.app/.netlify/functions/auto-settle-tips?limit=500
--
-- 2) Sprawdź pendingi:
select
  id,
  match_name,
  bet_type,
  prediction,
  market,
  odds,
  stake,
  status,
  result,
  settlement_status,
  result_status,
  settlement_reason,
  fixture_id,
  api_fixture_id,
  external_fixture_id,
  match_time,
  profit
from public.tips
where (
    username = 'betai-multisport-ai'
    or author_name = 'betai-multisport-ai'
    or author_name ilike '%BetAI%'
  )
order by match_time asc, created_at desc
limit 50;
