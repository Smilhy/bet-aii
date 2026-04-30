-- VERSION 146 — PRE VALUE BETS DIVERSITY + CLEAN OLD SAME PICKS

-- Czyścimy stare PRE wygenerowane stałym typem/kursami. Po kliknięciu "Skanuj realne mecze" zostaną zapisane od nowa, już z różnymi rynkami.
delete from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and (status = 'pending' or live_status = 'NS');

-- Upewniamy się, że potrzebne kolumny istnieją.
alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists league_id integer;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists kickoff_time timestamp;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists implied_probability numeric;
alter table public.tips add column if not exists value_score numeric;

-- Widoki zostają osobno: LIVE i PRE.
create or replace view public.ai_live_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'live'
order by kickoff_time desc;

create or replace view public.ai_pre_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
  and status = 'pending'
order by kickoff_time asc;

create or replace view public.ai_all_matches as
select *
from public.tips
where ai_source = 'real_ai_engine'
  and source = 'live_ai_engine'
order by case when status = 'live' then 0 else 1 end, kickoff_time asc;

notify pgrst, 'reload schema';
