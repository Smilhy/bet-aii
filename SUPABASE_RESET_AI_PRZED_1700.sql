-- WERSJA 1700 — reset starych/absurdalnych typów AI
delete from public.ai_bets;

select count(*) as ai_bets_after_reset
from public.ai_bets;
