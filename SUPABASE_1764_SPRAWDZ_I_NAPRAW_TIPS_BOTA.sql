-- 1764: sprawdzenie, czy profil czyta stare statusy z tabeli tips
select
  id,
  created_at,
  username,
  author_name,
  match,
  team_home,
  team_away,
  prediction,
  market_key,
  selection_key,
  status,
  result,
  settlement_status,
  profit,
  ai_source,
  ai_external_key
from tips
where
  (
    lower(coalesce(username, '')) like '%betai-multisport%'
    or lower(coalesce(author_name, '')) like '%betai multisport%'
    or lower(coalesce(ai_source, '')) like '%betai-multisport%'
  )
order by created_at desc
limit 100;

-- Jeżeli po uruchomieniu funkcji 1764 dalej zobaczysz stare zwroty,
-- najpierw pokaż wynik SELECT-a powyżej. Nie odpalaj ręcznych UPDATE bez sprawdzenia.
