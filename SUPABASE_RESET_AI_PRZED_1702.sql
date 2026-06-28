-- WERSJA 1702 — reset przed testem fixture-id/debug odds
delete from public.ai_bets;

select count(*) as ai_bets_after_reset
from public.ai_bets;
