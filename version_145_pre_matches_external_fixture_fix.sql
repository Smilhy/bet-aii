-- VERSION 140 — LIVE AI SCHEMA CACHE FIX
alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists ai_source text default 'user';
alter table public.tips add column if not exists source text default 'manual';
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists analysis text;
alter table public.tips add column if not exists status text default 'pending';
create index if not exists idx_tips_live_status_v140 on public.tips(live_status);
notify pgrst, 'reload schema';

drop view if exists public.ai_events_feed cascade;
create view public.ai_events_feed as
select * from public.tips
where ai_source = 'real_ai_engine'
order by case when source = 'live_ai_engine' then 0 else 1 end,
coalesce(event_time, kickoff_time, match_time, created_at) desc;

drop view if exists public.ai_live_events_feed cascade;
create view public.ai_live_events_feed as
select * from public.tips
where ai_source = 'real_ai_engine' and source = 'live_ai_engine'
order by created_at desc;
