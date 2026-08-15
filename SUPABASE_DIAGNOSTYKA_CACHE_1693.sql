-- BET+AI WERSJA 1693 — DIAGNOSTYKA CACHE MECZÓW

-- 1) Ile aktywnych/przyszłych meczów widzi cache?
select
  count(*) as aktywne_cache,
  count(*) filter (where commence_time > now()) as przyszle_mecze,
  count(*) filter (where commence_time::date = current_date) as dzis,
  count(*) filter (where commence_time::date = current_date + interval '1 day') as jutro,
  min(commence_time) as pierwszy_mecz,
  max(commence_time) as ostatni_mecz
from public.sports_fixture_cache
where expires_at > now();

-- 2) Lista aktywnych przyszłych meczów:
select
  cache_key,
  sport,
  country,
  league,
  home,
  away,
  commence_time,
  expires_at
from public.sports_fixture_cache
where expires_at > now()
  and commence_time > now()
order by commence_time asc
limit 100;

-- 3) Po ligach:
select
  sport,
  country,
  league,
  count(*) as ile
from public.sports_fixture_cache
where expires_at > now()
  and commence_time > now()
group by sport, country, league
order by ile desc
limit 50;
