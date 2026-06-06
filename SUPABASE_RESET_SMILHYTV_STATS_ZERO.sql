begin;

update public.profiles
set
  imported_total_tips = 0,
  imported_won_tips = 0,
  imported_lost_tips = 0,
  imported_pending_tips = 0,
  imported_profit = 0,
  imported_yield = 0,
  imported_total_staked = 0,
  imported_avg_odds = 0,
  imported_highest_odds = 0,
  imported_tips_amount = 0,
  imported_monthly_stats = '[]'::jsonb,
  imported_hourly_stats = '[]'::jsonb,
  imported_odds_range_stats = '[]'::jsonb,
  imported_sport_stats = '[]'::jsonb,
  imported_coupon_type_stats = '[]'::jsonb,
  stats_imported_at = null,
  updated_at = now()
where id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'
  and lower(username) = 'smilhytv';

delete from public.tips
where user_id = '1a3f01d7-5675-4abf-b851-6ecec78262f5';

commit;
