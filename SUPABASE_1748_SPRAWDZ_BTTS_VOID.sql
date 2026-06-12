-- 1748: sprawdzenie typów AI BTTS błędnie ustawionych jako VOID
-- Najpierw SELECT, potem po deployu uruchom settlement:
-- https://www.bet-ai.app/.netlify/functions/settle-live-ai-picks?limit=700

select
  id,
  created_at,
  match,
  home_team,
  away_team,
  prediction,
  market,
  bet_type,
  status,
  result,
  result_status,
  live_score_home,
  live_score_away,
  live_status,
  settlement_source
from ai_bets
where
  (
    coalesce(prediction, '') ilike '%obie%'
    or coalesce(prediction, '') ilike '%BTTS%'
    or coalesce(market, '') ilike '%BTTS%'
    or coalesce(bet_type, '') ilike '%BTTS%'
  )
  and (
    status in ('void', 'push')
    or result in ('void', 'push')
    or result_status in ('void', 'push')
  )
order by created_at desc
limit 100;
