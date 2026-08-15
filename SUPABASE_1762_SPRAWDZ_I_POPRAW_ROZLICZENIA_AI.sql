-- 1762: kontrola błędnych rozliczeń AI po poprawce over/under/X2
-- Po deployu uruchom najpierw funkcję z force=1:
-- https://www.bet-ai.app/.netlify/functions/settle-live-ai-picks?limit=700&force=1

-- 1) Sprawdź podejrzane typy, które wcześniej wpadały w Zwrot/VOID:
select
  id,
  created_at,
  match_date,
  match_time,
  to_jsonb(a)->>'match_name' as match_name,
  to_jsonb(a)->>'team_home' as team_home,
  to_jsonb(a)->>'team_away' as team_away,
  to_jsonb(a)->>'prediction' as prediction,
  to_jsonb(a)->>'market' as market,
  to_jsonb(a)->>'bet_type' as bet_type,
  to_jsonb(a)->>'market_key' as market_key,
  to_jsonb(a)->>'selection_key' as selection_key,
  to_jsonb(a)->>'status' as status,
  to_jsonb(a)->>'result' as result,
  to_jsonb(a)->>'profit' as profit,
  to_jsonb(a)->>'live_score_home' as live_score_home,
  to_jsonb(a)->>'live_score_away' as live_score_away,
  to_jsonb(a)->>'live_status' as live_status,
  to_jsonb(a)->>'settlement_source' as settlement_source,
  updated_at
from ai_bets a
where
  lower(coalesce(to_jsonb(a)->>'prediction','') || ' ' || coalesce(to_jsonb(a)->>'market','') || ' ' || coalesce(to_jsonb(a)->>'bet_type','') || ' ' || coalesce(to_jsonb(a)->>'selection_key',''))
  ~ '(powyżej|powyzej|poniżej|ponizej|over|under|x2|1x|12|podwójna|podwojna|lub remis)'
order by updated_at desc
limit 100;
