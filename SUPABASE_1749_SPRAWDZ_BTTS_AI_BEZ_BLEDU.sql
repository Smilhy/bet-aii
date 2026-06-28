-- 1749: diagnostyka BTTS w ai_bets bez błędu "column match does not exist"
-- Używa to_jsonb, więc działa nawet jeśli tabela nie ma kolumn match/home_team/away_team.

select
  id,
  created_at,
  updated_at,
  to_jsonb(a)->>'match' as match,
  to_jsonb(a)->>'match_name' as match_name,
  to_jsonb(a)->>'home_team' as home_team,
  to_jsonb(a)->>'team_home' as team_home,
  to_jsonb(a)->>'away_team' as away_team,
  to_jsonb(a)->>'team_away' as team_away,
  to_jsonb(a)->>'prediction' as prediction,
  to_jsonb(a)->>'market' as market,
  to_jsonb(a)->>'bet_type' as bet_type,
  to_jsonb(a)->>'status' as status,
  to_jsonb(a)->>'result' as result,
  to_jsonb(a)->>'result_status' as result_status,
  to_jsonb(a)->>'live_score_home' as live_score_home,
  to_jsonb(a)->>'live_score_away' as live_score_away,
  to_jsonb(a)->>'live_status' as live_status,
  to_jsonb(a)->>'settlement_source' as settlement_source
from ai_bets a
where
  (
    coalesce(to_jsonb(a)->>'prediction', '') ilike '%obie%'
    or coalesce(to_jsonb(a)->>'prediction', '') ilike '%BTTS%'
    or coalesce(to_jsonb(a)->>'market', '') ilike '%BTTS%'
    or coalesce(to_jsonb(a)->>'bet_type', '') ilike '%BTTS%'
  )
order by updated_at desc
limit 50;
