-- VERSION 133 — REAL AI PICKS ENGINE PRO + STATS UI

alter table public.tips add column if not exists ai_confidence numeric default 0;
alter table public.tips add column if not exists ai_score numeric default 0;
alter table public.tips add column if not exists ai_analysis text;
alter table public.tips add column if not exists value_score numeric default 0;
alter table public.tips add column if not exists risk_level text default 'medium';
alter table public.tips add column if not exists source text;
alter table public.tips add column if not exists event_time timestamptz;
alter table public.tips add column if not exists country text;

create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  source text,
  inserted_count integer default 0,
  status text default 'success',
  created_at timestamptz default now()
);

create or replace view public.real_ai_top_picks as
select *
from public.tips
where coalesce(ai_confidence, 0) > 0
order by ai_score desc, ai_confidence desc, created_at desc
limit 50;

alter table public.ai_pick_runs enable row level security;
drop policy if exists "ai_pick_runs_admin_read" on public.ai_pick_runs;
create policy "ai_pick_runs_admin_read"
on public.ai_pick_runs
for select
using (true);
