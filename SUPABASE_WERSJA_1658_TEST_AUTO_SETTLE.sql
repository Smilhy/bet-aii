-- WERSJA 1658 — opcjonalna kontrola typu Las Palmas - Malaga
-- Ten SQL tylko pokazuje dane. Rozliczanie robi Netlify function auto-settle-tips po deployu.

select
  id, fixture_id, api_fixture_id, external_fixture_id, team_home, team_away, league, match_date,
  bet_type, prediction, odds, status, settlement_status, result_status, result,
  final_score_home, final_score_away, result_home, result_away, settlement_note, updated_at
from public.tips
where team_home ilike '%Las Palmas%' or team_away ilike '%Malaga%'
order by created_at desc
limit 20;
