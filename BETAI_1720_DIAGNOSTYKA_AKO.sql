-- BETAI 1720 — diagnostyka AKO po wdrożeniu
-- 1) Sprawdź najnowsze AKO:
select
  id,
  username,
  author_name,
  coupon_type,
  is_ako,
  legs_count,
  odds,
  stake,
  status,
  result,
  settlement_status,
  settlement_reason,
  updated_at,
  created_at,
  jsonb_pretty(legs_json::jsonb) as legs
from public.tips
where is_ako = true
   or coupon_type = 'ako'
   or market = 'AKO'
order by created_at desc
limit 10;

-- 2) Ręcznie uruchom auto settlement w przeglądarce:
-- https://TWOJA-DOMENA.netlify.app/.netlify/functions/auto-settle-tips?limit=500
--
-- 3) Po uruchomieniu sprawdź, czy nogi mają status:
-- won / lost / void / pending / live
