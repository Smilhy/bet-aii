-- Usuń 3 testowe typy opublikowane przez 1730 po starcie meczów
delete from public.tips
where id in (
  'f2fadde7-c7a9-4dab-92d1-ad692153bcfa',
  '20fc3880-76cc-45dc-9134-e13ab0b18b46',
  'ce2d09e3-d7c8-48eb-8daf-b18612b12ab1'
);

-- Kontrola
select
  id,
  author_name,
  username,
  match_name,
  prediction,
  odds,
  status,
  created_at,
  tip_source
from public.tips
where username = 'betai-multisport-ai'
order by created_at desc
limit 20;
