-- 1765: sprawdzenie widocznych rekordów profilu bota w tips
select
  id,
  created_at,
  username,
  author_name,
  match,
  team_home,
  team_away,
  prediction,
  market,
  market_key,
  selection_key,
  odds,
  stake,
  status,
  result,
  result_status,
  settlement_status,
  profit,
  settlement_source,
  ai_source,
  ai_external_key,
  fixture_id,
  external_fixture_id
from tips
where
  lower(coalesce(username, '')) like '%betai-multisport%'
  or lower(coalesce(author_name, '')) like '%betai multisport%'
  or lower(coalesce(ai_source, '')) like '%betai-multisport%'
order by created_at desc
limit 150;
