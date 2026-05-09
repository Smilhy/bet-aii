-- BET+AI 738 — Supabase fix dla Typów AI / Live AI
-- Wklej całość w Supabase -> SQL Editor -> Run.
-- Ten SQL NIE dodaje żadnego płatnego API. Naprawia tylko bazę, żeby AI typy mogły się zapisać w public.tips.

create extension if not exists pgcrypto;

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.tips
  add column if not exists author_id uuid,
  add column if not exists user_id uuid,
  add column if not exists author_name text,
  add column if not exists author_email text,
  add column if not exists username text,
  add column if not exists external_fixture_id bigint,
  add column if not exists league_id bigint,
  add column if not exists league text,
  add column if not exists league_name text,
  add column if not exists sport text,
  add column if not exists country text,
  add column if not exists match text,
  add column if not exists match_name text,
  add column if not exists team_home text,
  add column if not exists team_away text,
  add column if not exists match_time timestamptz,
  add column if not exists event_time timestamptz,
  add column if not exists kickoff_time timestamptz,
  add column if not exists market text,
  add column if not exists bet_type text,
  add column if not exists selection text,
  add column if not exists pick text,
  add column if not exists prediction text,
  add column if not exists odds numeric,
  add column if not exists course numeric,
  add column if not exists stake numeric,
  add column if not exists implied_probability numeric,
  add column if not exists model_probability numeric,
  add column if not exists probability numeric,
  add column if not exists value_score numeric,
  add column if not exists ai_score numeric,
  add column if not exists ai_confidence numeric,
  add column if not exists ai_probability numeric,
  add column if not exists confidence numeric,
  add column if not exists risk_level text,
  add column if not exists bookmaker text,
  add column if not exists description text,
  add column if not exists analysis text,
  add column if not exists ai_analysis text,
  add column if not exists ai_source text,
  add column if not exists source text,
  add column if not exists ai_model_version text,
  add column if not exists quality_label text,
  add column if not exists live_minute integer not null default 0,
  add column if not exists live_score_home numeric not null default 0,
  add column if not exists live_score_away numeric not null default 0,
  add column if not exists live_status text,
  add column if not exists result text default 'pending',
  add column if not exists profit numeric not null default 0,
  add column if not exists access_type text default 'free',
  add column if not exists access text default 'free',
  add column if not exists is_premium boolean not null default false,
  add column if not exists price numeric not null default 0,
  add column if not exists single_price numeric not null default 0,
  add column if not exists tip_price numeric not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists likes integer not null default 0,
  add column if not exists dislikes integer not null default 0,
  add column if not exists tags text[] default '{}',
  add column if not exists notify_followers boolean default true;

-- Starsze wersje miały CHECK tylko pending/won/lost/void. Live AI potrafi zapisać status live.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.tips'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.tips drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.tips
  add constraint tips_status_check_v738
  check (status is null or status in ('pending','live','won','lost','void','cancelled','postponed','finished'));

-- Uzupełnij wymagane pola w starych rekordach.
update public.tips
set
  author_name = coalesce(nullif(author_name, ''), nullif(username, ''), 'Bet+AI'),
  league = coalesce(nullif(league, ''), nullif(league_name, ''), sport, 'Sport'),
  team_home = coalesce(nullif(team_home, ''), split_part(coalesce(match_name, match, 'Gospodarze vs Goście'), ' vs ', 1), 'Gospodarze'),
  team_away = coalesce(nullif(team_away, ''), nullif(split_part(coalesce(match_name, match, 'Gospodarze vs Goście'), ' vs ', 2), ''), 'Goście'),
  bet_type = coalesce(nullif(bet_type, ''), nullif(market, ''), 'Typ AI'),
  odds = coalesce(odds, course, 1.70),
  access_type = coalesce(nullif(access_type, ''), nullif(access, ''), case when is_premium then 'premium' else 'free' end, 'free'),
  access = coalesce(nullif(access, ''), nullif(access_type, ''), 'free'),
  status = coalesce(nullif(status, ''), 'pending'),
  result = coalesce(nullif(result, ''), 'pending')
where true;

create index if not exists idx_tips_created_v738 on public.tips (created_at desc);
create index if not exists idx_tips_ai_source_v738 on public.tips (ai_source, created_at desc);
create index if not exists idx_tips_source_v738 on public.tips (source, created_at desc);
create index if not exists idx_tips_sport_v738 on public.tips (sport, created_at desc);
create index if not exists idx_tips_status_v738 on public.tips (status);
create index if not exists idx_tips_ai_score_v738 on public.tips (ai_score desc);

create table if not exists public.ai_pick_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  source text,
  status text,
  picks_created integer default 0,
  message text
);

alter table public.tips enable row level security;
alter table public.ai_pick_runs enable row level security;

drop policy if exists "tips select all v738" on public.tips;
create policy "tips select all v738"
on public.tips for select
to anon, authenticated
using (true);

drop policy if exists "tips insert service/auth v738" on public.tips;
create policy "tips insert service/auth v738"
on public.tips for insert
to anon, authenticated
with check (true);

drop policy if exists "tips update service/auth v738" on public.tips;
create policy "tips update service/auth v738"
on public.tips for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "ai_pick_runs select v738" on public.ai_pick_runs;
create policy "ai_pick_runs select v738"
on public.ai_pick_runs for select
to anon, authenticated
using (true);
