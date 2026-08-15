-- WERSJA 1703 — reset przed testem strict full-time markets
delete from public.ai_bets;

select count(*) as ai_bets_after_reset
from public.ai_bets;
