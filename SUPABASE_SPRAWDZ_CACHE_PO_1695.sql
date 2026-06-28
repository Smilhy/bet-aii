select
  count(*) as aktywne_przyszle_2_dni
from public.sports_fixture_cache
where expires_at > now()
  and commence_time > now()
  and commence_time < now() + interval '2 days';

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
