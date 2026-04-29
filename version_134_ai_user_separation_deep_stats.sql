-- VERSION 132 — AI SYSTEM

alter table public.tips
add column if not exists ai_confidence numeric default 0;

alter table public.tips
add column if not exists ai_score numeric default 0;

alter table public.tips
add column if not exists ai_analysis text;

update public.tips
set
  ai_confidence = coalesce(nullif(ai_confidence, 0), ai_probability, 0),
  ai_score = coalesce(nullif(ai_score, 0), least(100, round(coalesce(ai_probability, 0) * coalesce(odds, 1)))),
  ai_analysis = coalesce(ai_analysis, analysis)
where true;

create or replace view public.ai_top_picks as
select
  id, author_id, author_name, league, team_home, team_away, bet_type, odds,
  access_type, is_premium, price, ai_confidence, ai_score, ai_analysis, created_at
from public.tips
order by ai_score desc nulls last, ai_confidence desc nulls last, created_at desc
limit 50;
