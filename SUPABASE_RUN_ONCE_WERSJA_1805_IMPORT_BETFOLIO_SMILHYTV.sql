-- BetAI WERSJA 1805 — import statystyk Betfolio profilu smilhytv
-- Wklej całość do Supabase -> SQL Editor -> Run, tylko po wdrożeniu paczki v1805.
--
-- Import tworzy historyczną bazę statystyk:
--   812 rozliczonych typów + 0 pending = 812 wszystkich typów,
--   474 wygrane, 338 przegrane,
--   stawki 246510.00, profit 85963.39, yield 34.87%,
--   średni kurs 1.84, maksymalny kurs 48.00.
--
-- Każdy kolejny typ dodany w BetAI po dacie importu jest automatycznie
-- dopisywany do tej bazy. Skrypt nie tworzy fikcyjnych meczów historycznych,
-- bo screeny zawierają statystyki zbiorcze, a nie listę 812 spotkań.

begin;

alter table public.profiles add column if not exists imported_stats_additive boolean not null default false;
alter table public.profiles add column if not exists imported_total_tips integer not null default 0;
alter table public.profiles add column if not exists imported_won_tips integer not null default 0;
alter table public.profiles add column if not exists imported_lost_tips integer not null default 0;
alter table public.profiles add column if not exists imported_void_tips integer not null default 0;
alter table public.profiles add column if not exists imported_pending_tips integer not null default 0;
alter table public.profiles add column if not exists imported_profit numeric(18,2) not null default 0;
alter table public.profiles add column if not exists imported_yield numeric(12,4) not null default 0;
alter table public.profiles add column if not exists imported_total_staked numeric(18,2) not null default 0;
alter table public.profiles add column if not exists imported_avg_odds numeric(12,4) not null default 0;
alter table public.profiles add column if not exists imported_highest_odds numeric(12,4) not null default 0;
alter table public.profiles add column if not exists imported_bet_format_stats jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists imported_coupon_type_stats jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists imported_sport_stats jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists imported_odds_range_stats jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists imported_hourly_stats jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists imported_monthly_stats jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists stats_imported_at timestamptz;

update public.profiles p
set
  imported_stats_additive = true,
  imported_total_tips = 812,
  imported_won_tips = 474,
  imported_lost_tips = 338,
  imported_void_tips = 0,
  imported_pending_tips = 0,
  imported_profit = 85963.39,
  imported_yield = 34.87,
  imported_total_staked = 246510.00,
  imported_avg_odds = 1.84,
  imported_highest_odds = 48.00,

  imported_bet_format_stats = '[
    {"label":"SOLO","coupons":738,"stake":229385.16,"profit":74406.94,"yield":32.44,"flatYield":7.24,"avgOdds":1.85,"avgStake":310.82},
    {"label":"AKO","coupons":69,"stake":15093.06,"profit":5279.15,"yield":34.98,"flatYield":0.95,"avgOdds":2.15,"avgStake":218.74},
    {"label":"BetBuilder","coupons":5,"stake":2030.00,"profit":6277.30,"yield":309.25,"flatYield":101.20,"avgOdds":3.12,"avgStake":406.00}
  ]'::jsonb,

  imported_coupon_type_stats = '[
    {"label":"Publiczny","coupons":209,"stake":76044.65,"profit":24119.34,"yield":31.72,"flatYield":17.58,"avgOdds":1.80,"avgStake":363.85},
    {"label":"Płatny","coupons":603,"stake":170468.10,"profit":61844.05,"yield":36.28,"flatYield":3.72,"avgOdds":1.91,"avgStake":282.70}
  ]'::jsonb,

  imported_sport_stats = '[
    {"label":"MMA","coupons":47,"stake":33073.99,"profit":75029.02,"yield":226.85,"flatYield":149.77},
    {"label":"Baseball","coupons":26,"stake":5215.00,"profit":4107.70,"yield":78.77,"flatYield":16.85},
    {"label":"Krykiet","coupons":2,"stake":50.00,"profit":16.80,"yield":33.60,"flatYield":-16.50},
    {"label":"Boks","coupons":7,"stake":4025.00,"profit":458.15,"yield":11.38,"flatYield":-11.57},
    {"label":"Piłka nożna","coupons":617,"stake":148063.34,"profit":11717.99,"yield":7.91,"flatYield":-3.20},
    {"label":"Tenis","coupons":11,"stake":23478.67,"profit":1531.44,"yield":6.52,"flatYield":4.64},
    {"label":"Darts","coupons":4,"stake":50.00,"profit":0.70,"yield":1.40,"flatYield":-13.50},
    {"label":"Hokej","coupons":30,"stake":8036.00,"profit":-45.60,"yield":-0.57,"flatYield":7.60},
    {"label":"Koszykówka","coupons":24,"stake":5488.00,"profit":-1241.61,"yield":-22.62,"flatYield":9.96},
    {"label":"Snooker","coupons":22,"stake":19030.00,"profit":-5611.20,"yield":-29.49,"flatYield":-26.05}
  ]'::jsonb,

  imported_odds_range_stats = '[
    {"label":"1.01 - 1.50","coupons":153,"profit":2085.96,"yield":3.97,"flatYield":-8.60,"avgOdds":1.45,"avgStake":343.82},
    {"label":"1.51 - 2.00","coupons":531,"profit":6893.39,"yield":4.80,"flatYield":0.21,"avgOdds":1.71,"avgStake":270.32},
    {"label":"2.01 - 3.00","coupons":88,"profit":16449.98,"yield":53.94,"flatYield":17.01,"avgOdds":2.26,"avgStake":346.55},
    {"label":"3.01 - 5.00","coupons":31,"profit":2154.06,"yield":14.61,"flatYield":-3.83,"avgOdds":3.59,"avgStake":475.74},
    {"label":"5.01 - 8.00","coupons":1,"profit":4100.00,"yield":410.00,"flatYield":410.00,"avgOdds":5.10,"avgStake":1000.00},
    {"label":"8.01 - 9.99","coupons":1,"profit":7290.00,"yield":729.00,"flatYield":729.00,"avgOdds":8.29,"avgStake":1000.00},
    {"label":"10.00+","coupons":2,"profit":46990.00,"yield":4652.48,"flatYield":2300.00,"avgOdds":36.40,"avgStake":505.00}
  ]'::jsonb,

  imported_hourly_stats = '[
    {"label":"00:00 - 07:59","coupons":128,"profit":59680.45,"yield":129.94,"flatYield":50.39,"avgOdds":2.28,"avgStake":358.84},
    {"label":"08:00 - 11:59","coupons":63,"profit":1548.82,"yield":13.27,"flatYield":2.99,"avgOdds":1.74,"avgStake":185.24},
    {"label":"12:00 - 16:59","coupons":206,"profit":-216.96,"yield":-0.61,"flatYield":-3.47,"avgOdds":1.78,"avgStake":171.35},
    {"label":"17:00 - 19:59","coupons":252,"profit":14451.42,"yield":16.60,"flatYield":-1.42,"avgOdds":1.80,"avgStake":345.42},
    {"label":"20:00 - 23:59","coupons":163,"profit":10499.66,"yield":15.77,"flatYield":2.15,"avgOdds":1.90,"avgStake":408.37}
  ]'::jsonb,

  imported_monthly_stats = '[
    {"label":"06/2026","coupons":50,"stake":23900.00,"profit":3447.30,"yield":14.42,"flatYield":5.99},
    {"label":"05/2026","coupons":128,"stake":39150.00,"profit":4645.30,"yield":11.87,"flatYield":-8.69},
    {"label":"04/2026","coupons":251,"stake":74481.00,"profit":5850.88,"yield":7.86,"flatYield":-4.72},
    {"label":"03/2026","coupons":272,"stake":105496.00,"profit":70296.40,"yield":66.63,"flatYield":23.55},
    {"label":"02/2026","coupons":58,"stake":3165.00,"profit":1593.26,"yield":50.34,"flatYield":17.06},
    {"label":"01/2026","coupons":53,"stake":318.00,"profit":130.25,"yield":40.96,"flatYield":9.77},
    {"label":"11/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00,"flatYield":0.00},
    {"label":"10/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00,"flatYield":0.00},
    {"label":"09/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00,"flatYield":0.00},
    {"label":"08/2025","coupons":0,"stake":0.00,"profit":0.00,"yield":0.00,"flatYield":0.00}
  ]'::jsonb,

  stats_imported_at = case
    when p.imported_stats_additive = true and p.stats_imported_at is not null then p.stats_imported_at
    else now()
  end,
  updated_at = now()
where p.id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'::uuid
   or lower(coalesce(to_jsonb(p)->>'email', '')) = 'smilhytv@gmail.com'
   or lower(coalesce(to_jsonb(p)->>'username', '')) = 'smilhytv'
   or lower(coalesce(to_jsonb(p)->>'public_slug', '')) = 'smilhytv';

-- Kontrola: powinien wrócić dokładnie jeden profil i wartości 815 / 474 / 338 / 3.
select
  id,
  username,
  imported_stats_additive,
  imported_total_tips,
  imported_won_tips,
  imported_lost_tips,
  imported_pending_tips,
  imported_total_staked,
  imported_profit,
  imported_yield,
  imported_avg_odds,
  imported_highest_odds,
  stats_imported_at
from public.profiles p
where p.id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'::uuid
   or lower(coalesce(to_jsonb(p)->>'email', '')) = 'smilhytv@gmail.com'
   or lower(coalesce(to_jsonb(p)->>'username', '')) = 'smilhytv'
   or lower(coalesce(to_jsonb(p)->>'public_slug', '')) = 'smilhytv';

commit;
