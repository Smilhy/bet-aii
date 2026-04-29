-- VERSION 153 — TABS LOGIC + ANALYSIS MODAL + AUTO REFRESH SUPPORT

-- This schema extension keeps API-Football/AI fields available for the analysis modal.
alter table public.tips add column if not exists external_fixture_id bigint;
alter table public.tips add column if not exists external_home_team_id bigint;
alter table public.tips add column if not exists external_away_team_id bigint;
alter table public.tips add column if not exists home_team text;
alter table public.tips add column if not exists away_team text;
alter table public.tips add column if not exists league_id integer;
alter table public.tips add column if not exists league_name text;
alter table public.tips add column if not exists country text;
alter table public.tips add column if not exists kickoff_time timestamp;
alter table public.tips add column if not exists live_status text;
alter table public.tips add column if not exists live_minute integer;
alter table public.tips add column if not exists live_score_home integer;
alter table public.tips add column if not exists live_score_away integer;
alter table public.tips add column if not exists market text;
alter table public.tips add column if not exists selection text;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists confidence numeric;
alter table public.tips add column if not exists model_probability numeric;
alter table public.tips add column if not exists model_reason text;
alter table public.tips add column if not exists ai_model_version text default 'v153-tabs-analysis';
alter table public.tips add column if not exists form_home_score numeric;
alter table public.tips add column if not exists form_away_score numeric;
alter table public.tips add column if not exists attack_home_score numeric;
alter table public.tips add column if not exists attack_away_score numeric;
alter table public.tips add column if not exists defense_home_score numeric;
alter table public.tips add column if not exists defense_away_score numeric;
alter table public.tips add column if not exists xg_home numeric;
alter table public.tips add column if not exists xg_away numeric;
alter table public.tips add column if not exists xg_home_proxy numeric;
alter table public.tips add column if not exists xg_away_proxy numeric;
alter table public.tips add column if not exists h2h_home_score numeric;
alter table public.tips add column if not exists h2h_away_score numeric;
alter table public.tips add column if not exists h2h_btts_rate numeric;
alter table public.tips add column if not exists h2h_over25_rate numeric;
alter table public.tips add column if not exists h2h_avg_goals numeric;
alter table public.tips add column if not exists shots_home integer;
alter table public.tips add column if not exists shots_away integer;
alter table public.tips add column if not exists shots_total_home integer;
alter table public.tips add column if not exists shots_total_away integer;
alter table public.tips add column if not exists shots_on_home integer;
alter table public.tips add column if not exists shots_on_away integer;
alter table public.tips add column if not exists possession_home numeric;
alter table public.tips add column if not exists possession_away numeric;
alter table public.tips add column if not exists corners_home integer;
alter table public.tips add column if not exists corners_away integer;
alter table public.tips add column if not exists dangerous_attacks_home integer;
alter table public.tips add column if not exists dangerous_attacks_away integer;
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists quality text;
alter table public.tips add column if not exists quality_label text;
alter table public.tips add column if not exists quality_score numeric;
alter table public.tips add column if not exists is_top_value boolean default false;
alter table public.tips add column if not exists profit numeric default 0;
alter table public.tips add column if not exists updated_at timestamp;

-- Sync LIVE/PRE/FT status for correct tabs.
create or replace function public.sync_ai_match_status()
returns trigger as $$
begin
  if new.live_status in ('LIVE','1H','2H','HT') or coalesce(new.live_minute, 0) > 0 then
    if new.live_status not in ('FT','AET','PEN','FINISHED','Match Finished') then
      new.status := 'live';
    end if;
  elsif new.live_status in ('NS','NOT_STARTED') then
    new.status := 'pending';
  end if;

  if new.live_status in ('FT','AET','PEN','FINISHED','Match Finished') then
    if new.live_score_home > new.live_score_away then
      new.status := 'won';
      new.profit := coalesce(new.odds, 1) - 1;
    elsif new.live_score_home < new.live_score_away then
      new.status := 'lost';
      new.profit := -1;
    else
      new.status := 'void';
      new.profit := 0;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_ai_match_status on public.tips;
create trigger trg_sync_ai_match_status
before insert or update on public.tips
for each row execute function public.sync_ai_match_status();

alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips add constraint tips_status_check check (status in ('pending','live','won','lost','void'));

create index if not exists idx_tips_ai_fixture_v153 on public.tips(external_fixture_id);
create index if not exists idx_tips_ai_status_v153 on public.tips(ai_source, source, status);
create index if not exists idx_tips_ai_value_v153 on public.tips(value_score desc);

notify pgrst, 'reload schema';
