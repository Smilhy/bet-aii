-- BETAI 1729 — wyczyszczenie jutrzejszych typów AI z aktywnej zakładki, jeśli wpadły przez days=2
-- UWAGA: usuwa tylko PENDING z ai_bets z datą większą niż dzisiejsza data w Polsce.
-- Nie rusza rozliczonych typów ani historii.

delete from public.ai_bets
where status = 'pending'
  and match_date > (now() at time zone 'Europe/Warsaw')::date;

-- kontrola:
select
  match_date,
  count(*) as pending_count
from public.ai_bets
where status = 'pending'
group by match_date
order by match_date;
