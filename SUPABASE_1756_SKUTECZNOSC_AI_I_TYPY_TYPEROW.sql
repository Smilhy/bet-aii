-- 1756: kontrola liczników logowania
-- 1) Skuteczność AI liczona z ai_bets: WON / (WON + LOST)
select
  sum(case when lower(coalesce(status,'') || ' ' || coalesce(result,'') || ' ' || coalesce(result_status,'') || ' ' || coalesce(settlement_status,'')) ~ '(won|win|wygran)' then 1 else 0 end) as ai_won,
  sum(case when lower(coalesce(status,'') || ' ' || coalesce(result,'') || ' ' || coalesce(result_status,'') || ' ' || coalesce(settlement_status,'')) ~ '(lost|loss|przegran)' then 1 else 0 end) as ai_lost,
  round(
    100.0 *
    sum(case when lower(coalesce(status,'') || ' ' || coalesce(result,'') || ' ' || coalesce(result_status,'') || ' ' || coalesce(settlement_status,'')) ~ '(won|win|wygran)' then 1 else 0 end)
    /
    nullif(
      sum(case when lower(coalesce(status,'') || ' ' || coalesce(result,'') || ' ' || coalesce(result_status,'') || ' ' || coalesce(settlement_status,'')) ~ '(won|win|wygran|lost|loss|przegran)' then 1 else 0 end),
      0
    )
  ) as skutecznosc_ai_proc
from ai_bets;

-- 2) Aktywne typy typerów z tips, bez AI
select
  count(*) as aktywne_typy_typerow
from tips
where
  (
    ai_source is null
    or lower(ai_source) = 'user_manual'
  )
  and (
    source is null
    or lower(source) not like '%live_ai_engine%'
  )
  and lower(coalesce(author_name, '')) not like '%betai multisport%'
  and lower(coalesce(username, '')) not like '%betai-multisport-ai%'
  and lower(coalesce(status, 'pending')) not in ('won','win','lost','loss','void','push','settled','cancelled','canceled')
  and lower(coalesce(result, 'pending')) not in ('won','win','lost','loss','void','push','settled','cancelled','canceled')
  and lower(coalesce(result_status, 'pending')) not in ('won','win','lost','loss','void','push','settled','cancelled','canceled')
  and lower(coalesce(settlement_status, 'pending')) not in ('won','win','lost','loss','void','push','settled','cancelled','canceled');
