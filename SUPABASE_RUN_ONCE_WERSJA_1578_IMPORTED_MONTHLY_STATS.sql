-- BetAI v1578 - import miesięcznych statystyk profilu smilhytv
alter table public.profiles
  add column if not exists imported_monthly_stats jsonb not null default '[]'::jsonb;

update public.profiles
set
  imported_monthly_stats = '[
    {"label":"06/2026","coupons":3,"stake":130.00,"profit":93.20,"yield":72.00},
    {"label":"05/2026","coupons":128,"stake":39150.00,"profit":4645.30,"yield":12.00},
    {"label":"04/2026","coupons":251,"stake":74481.00,"profit":5850.88,"yield":8.00},
    {"label":"03/2026","coupons":272,"stake":105496.00,"profit":70296.40,"yield":67.00},
    {"label":"02/2026","coupons":58,"stake":3165.00,"profit":1593.26,"yield":50.00},
    {"label":"01/2026","coupons":53,"stake":318.00,"profit":130.25,"yield":41.00},
    {"label":"12/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00},
    {"label":"11/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00},
    {"label":"10/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00},
    {"label":"09/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00}
  ]'::jsonb,
  imported_total_tips = 765,
  imported_won_tips = 447,
  imported_lost_tips = 318,
  imported_pending_tips = 0,
  imported_profit = 82609.29,
  imported_yield = 37.00,
  imported_total_staked = 222740.00,
  imported_avg_odds = 1.85,
  imported_highest_odds = 48.00,
  stats_imported_at = now(),
  updated_at = now()
where id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'
  and lower(username) = 'smilhytv';

select
  username,
  imported_monthly_stats,
  imported_total_tips,
  imported_profit,
  imported_total_staked
from public.profiles
where id = '1a3f01d7-5675-4abf-b851-6ecec78262f5';
