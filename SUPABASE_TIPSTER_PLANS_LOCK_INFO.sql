-- INFO: To nie jest obowiązkowy patch do odpalania drugi raz.
-- Ten plik opisuje docelową strukturę tabeli tipster_plans po stabilizacji.
-- Odpalaj tylko jeśli tabela zostanie przypadkowo uszkodzona/usunięta.

-- Docelowe plan_key:
-- week      = 7 dni
-- month     = 30 dni
-- half_year = 180 dni
-- year      = 365 dni

select * from public.tipster_plans order by tipster_id, plan_key;
