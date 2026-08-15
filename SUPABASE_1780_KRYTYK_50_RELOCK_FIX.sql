-- BET+AI — WERSJA 1780
-- Poprawka dla osiągnięcia "Krytyk Bukmacherski":
-- 1) cel ma wynosić 50 ocen,
-- 2) odznaka ma być odblokowana dopiero przy 50/50,
-- 3) stare rekordy 1/1 zostają naprawione.

begin;

update public.tipster_achievement_progress
set
  target_value = 50,
  unlocked = case when coalesce(current_value, 0) >= 50 then true else false end,
  unlocked_at = case
    when coalesce(current_value, 0) >= 50 then coalesce(unlocked_at, now())
    else null
  end,
  updated_at = now()
where achievement_key = 'krytyk-bukmacherski';

commit;
