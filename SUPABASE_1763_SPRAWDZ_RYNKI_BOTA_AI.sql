-- 1763: diagnostyka rynków betai-multisport-ai w ai_bets
-- Pokazuje ostatnie rekordy bota z rynkami, kluczami, wynikiem i statusem.

select
  id,
  created_at,
  to_jsonb(a)->>'match_name' as match_name,
  coalesce(to_jsonb(a)->>'team_home', to_jsonb(a)->>'home_team') as home_team,
  coalesce(to_jsonb(a)->>'team_away', to_jsonb(a)->>'away_team') as away_team,
  to_jsonb(a)->>'market' as market,
  to_jsonb(a)->>'market_key' as market_key,
  to_jsonb(a)->>'prediction' as prediction,
  to_jsonb(a)->>'selection_key' as selection_key,
  to_jsonb(a)->>'status' as status,
  to_jsonb(a)->>'result' as result,
  to_jsonb(a)->>'result_status' as result_status,
  to_jsonb(a)->>'live_score_home' as live_score_home,
  to_jsonb(a)->>'live_score_away' as live_score_away,
  to_jsonb(a)->>'live_status' as live_status,
  to_jsonb(a)->>'settlement_source' as settlement_source,
  to_jsonb(a)->>'profit' as profit
from ai_bets a
where
  lower(coalesce(to_jsonb(a)->>'author_name', '')) like '%betai multisport%'
  or lower(coalesce(to_jsonb(a)->>'ai_source', '')) like '%betai-multisport%'
  or lower(coalesce(to_jsonb(a)->>'ai_model_version', '')) like '%betai-multisport%'
order by created_at desc
limit 100;
