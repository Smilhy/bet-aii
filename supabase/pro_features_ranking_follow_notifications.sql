-- =========================
-- BETAI PRO FEATURES v108
-- Ranking, ROI/winrate helpers, follow tipstera, notifications, auto payouts metadata
-- =========================

-- 1) Follow tipsterów
create table if not exists tipster_follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references profiles(id) on delete cascade,
  tipster_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now(),
  unique (follower_id, tipster_id)
);

create index if not exists idx_tipster_follows_follower on tipster_follows(follower_id);
create index if not exists idx_tipster_follows_tipster on tipster_follows(tipster_id);

-- 2) Powiadomienia
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text default 'info',
  title text,
  body text,
  tip_id uuid,
  tipster_id uuid,
  read_at timestamp,
  created_at timestamp default now()
);

create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on notifications(user_id, read_at);

-- 3) Funkcja powiadomień dla followersów po dodaniu typu
create or replace function public.notify_followers_new_tip(
  p_tip_id uuid,
  p_tipster_id uuid,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, body, tip_id, tipster_id)
  select
    follower_id,
    'new_tip',
    coalesce(p_title, 'Nowy typ od obserwowanego tipstera'),
    coalesce(p_body, 'Tipster, którego obserwujesz, dodał nowy typ.'),
    p_tip_id,
    p_tipster_id
  from tipster_follows
  where tipster_id = p_tipster_id;
end;
$$;

-- 4) Trigger automatyczny jako backup, jeśli frontend nie wywoła RPC
create or replace function public.notify_followers_new_tip_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.notify_followers, true) = true then
    perform public.notify_followers_new_tip(
      new.id,
      new.author_id,
      'Nowy typ od ' || coalesce(new.author_name, 'tipstera'),
      coalesce(new.team_home, '') || ' vs ' || coalesce(new.team_away, '') || ' • ' || coalesce(new.bet_type, '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_followers_new_tip on tips;
create trigger trg_notify_followers_new_tip
after insert on tips
for each row
execute function public.notify_followers_new_tip_trigger();

-- 5) Widok statystyk tipsterów pod ranking PRO
create or replace view public.tipster_rankings as
select
  t.author_id as tipster_id,
  max(t.author_name) as tipster_name,
  count(*)::int as total_tips,
  count(*) filter (where coalesce(t.is_premium, false) = true or t.access_type = 'premium')::int as premium_tips,
  count(*) filter (where t.status = 'won')::int as won_tips,
  count(*) filter (where t.status = 'lost')::int as lost_tips,
  case
    when (count(*) filter (where t.status in ('won','lost'))) = 0 then 0
    else round((count(*) filter (where t.status = 'won'))::numeric / nullif((count(*) filter (where t.status in ('won','lost')))::numeric, 0) * 100, 2)
  end as winrate,
  coalesce(sum(e.amount), 0) as profit,
  case
    when count(*) = 0 then 0
    else round(coalesce(sum(e.amount), 0) / greatest(count(*)::numeric * 10, 1) * 100, 2)
  end as roi
from tips t
left join earnings e on e.tipster_id = t.author_id
group by t.author_id;

-- 6) Auto payouts: helper statusu cron
create table if not exists payout_cron_runs (
  id uuid default gen_random_uuid() primary key,
  processed_count int default 0,
  failed_count int default 0,
  created_at timestamp default now()
);
