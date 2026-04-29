-- VERSION 156 — UI PIXEL PERFECT SUPPORT
-- Frontend-only visual upgrade. This SQL only ensures analysis fields exist.

alter table public.tips add column if not exists analysis_clean text;
alter table public.tips add column if not exists value_color text;
alter table public.tips add column if not exists quality_label text;
alter table public.tips add column if not exists quality_score numeric;
alter table public.tips add column if not exists prob_home numeric;
alter table public.tips add column if not exists prob_draw numeric;
alter table public.tips add column if not exists prob_away numeric;

update public.tips
set value_color = case
  when coalesce(value_score,0) >= 10 then 'green'
  when coalesce(value_score,0) >= 5 then 'lightgreen'
  when coalesce(value_score,0) >= 0 then 'neutral'
  else 'red'
end;

update public.tips
set quality_label = case
  when coalesce(value_score,0) >= 15 then '💎 DIAMOND'
  when coalesce(value_score,0) >= 10 then '🔥 HOT VALUE'
  when coalesce(value_score,0) >= 5 then '⭐ VALUE'
  else 'LOW'
end;

notify pgrst, 'reload schema';
