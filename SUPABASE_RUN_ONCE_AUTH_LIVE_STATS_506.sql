-- SUPABASE_RUN_ONCE_AUTH_LIVE_STATS_506.sql
-- Uruchom raz w Supabase SQL Editor, jeśli chcesz mieć
-- publiczne / pre-login realne statystyki live na ekranie logowania.

create table if not exists public.presence_heartbeats (
  user_id uuid primary key,
  email text,
  last_seen timestamptz default now()
);

alter table public.presence_heartbeats enable row level security;

drop policy if exists "presence_select_all" on public.presence_heartbeats;
create policy "presence_select_all"
on public.presence_heartbeats
for select
using (true);

drop policy if exists "presence_insert_all" on public.presence_heartbeats;
create policy "presence_insert_all"
on public.presence_heartbeats
for insert
with check (true);

drop policy if exists "presence_update_all" on public.presence_heartbeats;
create policy "presence_update_all"
on public.presence_heartbeats
for update
using (true)
with check (true);

create or replace function public.get_auth_live_stats()
returns table (
  registered_users bigint,
  ai_accuracy integer,
  active_now bigint,
  tips_today bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registered_users bigint := 0;
  v_ai_accuracy integer := 76;
  v_active_now bigint := 0;
  v_tips_today bigint := 0;
  v_ai_total bigint := 0;
  v_ai_won bigint := 0;
  v_ai_confidence_avg numeric := 76;
  v_today_start timestamptz := date_trunc('day', now());
  v_active_cutoff timestamptz := now() - interval '10 minutes';
  v_ai_cutoff timestamptz := now() - interval '30 days';
begin
  if to_regclass('public.profiles') is not null then
    execute 'select count(*) from public.profiles' into v_registered_users;
  end if;

  if to_regclass('public.presence_heartbeats') is not null then
    execute 'select count(distinct user_id) from public.presence_heartbeats where last_seen >= $1'
      into v_active_now using v_active_cutoff;
  end if;

  if to_regclass('public.tips') is not null then
    execute 'select count(*) from public.tips where created_at >= $1'
      into v_tips_today using v_today_start;

    execute $$
      select count(*)
      from public.tips
      where coalesce(ai_source, '') = 'real_ai_engine'
        and created_at >= $1
        and lower(coalesce(status, '')) in ('won','win','wygrany','wygrana','lost','loss','przegrany','przegrana')
    $$ into v_ai_total using v_ai_cutoff;

    execute $$
      select count(*)
      from public.tips
      where coalesce(ai_source, '') = 'real_ai_engine'
        and created_at >= $1
        and lower(coalesce(status, '')) in ('won','win','wygrany','wygrana')
    $$ into v_ai_won using v_ai_cutoff;

    if v_ai_total > 0 then
      v_ai_accuracy := round((v_ai_won::numeric / v_ai_total::numeric) * 100);
    else
      execute $$
        select coalesce(avg(confidence_value), 76)
        from (
          select nullif(coalesce(ai_confidence::text, ai_probability::text, confidence::text), '')::numeric as confidence_value
          from public.tips
          where coalesce(ai_source, '') = 'real_ai_engine'
          order by created_at desc
          limit 50
        ) s
      $$ into v_ai_confidence_avg;

      v_ai_accuracy := round(coalesce(v_ai_confidence_avg, 76));
    end if;
  end if;

  return query
  select
    coalesce(v_registered_users, 0),
    greatest(0, least(coalesce(v_ai_accuracy, 76), 100)),
    coalesce(v_active_now, 0),
    coalesce(v_tips_today, 0);
end;
$$;

grant execute on function public.get_auth_live_stats() to anon, authenticated;
