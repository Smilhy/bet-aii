-- WERSJA 1699 — reset starych Typów AI przed testem realnych kursów API-Football
delete from public.ai_bets;

select count(*) as ai_bets_after_reset
from public.ai_bets;
