-- BETAI_SQL_904_REALNY_RANKING_PROFIT_TYPERA.sql
-- Realny ranking typerów: profit decyduje o miejscu.
-- Uruchom w Supabase SQL Editor.

CREATE OR REPLACE VIEW public.tipster_ranking_live AS
WITH profile_stats AS (
  SELECT
    p.id AS tipster_id,
    p.email,
    COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), 'Użytkownik') AS username,
    p.avatar_url,
    COALESCE(p.imported_total_tips, 0)::numeric AS imported_total_tips,
    COALESCE(p.imported_won_tips, 0)::numeric AS imported_won_tips,
    COALESCE(p.imported_lost_tips, 0)::numeric AS imported_lost_tips,
    COALESCE(p.imported_profit, 0)::numeric AS imported_profit,
    COALESCE(p.imported_yield, 0)::numeric AS imported_yield
  FROM public.profiles p
),
tip_stats AS (
  SELECT
    COALESCE(t.author_id, t.user_id) AS tipster_id,
    COUNT(*)::numeric AS tips_count,
    COUNT(*) FILTER (WHERE lower(coalesce(t.status, t.result, '')) IN ('won','win','wygrany','wygrana'))::numeric AS wins,
    COUNT(*) FILTER (WHERE lower(coalesce(t.status, t.result, '')) IN ('lost','loss','lose','przegrany','przegrana'))::numeric AS losses,
    SUM(
      CASE
        WHEN lower(coalesce(t.status, t.result, '')) IN ('won','win','wygrany','wygrana')
          THEN COALESCE(t.profit, t.result_profit, t.profit_amount, (COALESCE(t.stake,0) * GREATEST(COALESCE(t.odds,0)-1,0)), 0)
        WHEN lower(coalesce(t.status, t.result, '')) IN ('lost','loss','lose','przegrany','przegrana')
          THEN COALESCE(t.profit, t.result_profit, t.profit_amount, -COALESCE(t.stake,0), 0)
        ELSE COALESCE(t.profit, t.result_profit, t.profit_amount, 0)
      END
    )::numeric AS tips_profit,
    SUM(
      CASE
        WHEN lower(coalesce(t.status, t.result, '')) IN ('won','win','wygrany','wygrana','lost','loss','lose','przegrany','przegrana')
          THEN COALESCE(t.stake,0)
        ELSE 0
      END
    )::numeric AS total_staked
  FROM public.tips t
  WHERE COALESCE(t.author_id, t.user_id) IS NOT NULL
  GROUP BY COALESCE(t.author_id, t.user_id)
)
SELECT
  ps.tipster_id,
  ps.email,
  ps.username,
  ps.avatar_url,
  GREATEST(ps.imported_total_tips, COALESCE(ts.tips_count,0)) AS total_tips,
  GREATEST(ps.imported_won_tips, COALESCE(ts.wins,0)) AS wins,
  GREATEST(ps.imported_lost_tips, COALESCE(ts.losses,0)) AS losses,
  CASE
    WHEN abs(ps.imported_profit) >= abs(COALESCE(ts.tips_profit,0)) THEN ps.imported_profit
    ELSE COALESCE(ts.tips_profit,0)
  END AS earnings,
  CASE
    WHEN abs(ps.imported_profit) >= abs(COALESCE(ts.tips_profit,0)) THEN ps.imported_profit
    ELSE COALESCE(ts.tips_profit,0)
  END AS profit,
  CASE
    WHEN ps.imported_yield <> 0 THEN ps.imported_yield
    WHEN COALESCE(ts.total_staked,0) > 0 THEN COALESCE(ts.tips_profit,0) / ts.total_staked * 100
    ELSE 0
  END AS roi,
  CASE
    WHEN (GREATEST(ps.imported_won_tips, COALESCE(ts.wins,0)) + GREATEST(ps.imported_lost_tips, COALESCE(ts.losses,0))) > 0
      THEN GREATEST(ps.imported_won_tips, COALESCE(ts.wins,0)) / (GREATEST(ps.imported_won_tips, COALESCE(ts.wins,0)) + GREATEST(ps.imported_lost_tips, COALESCE(ts.losses,0))) * 100
    ELSE 0
  END AS winrate
FROM profile_stats ps
LEFT JOIN tip_stats ts ON ts.tipster_id = ps.tipster_id
WHERE
  GREATEST(ps.imported_total_tips, COALESCE(ts.tips_count,0)) > 0
ORDER BY profit DESC, roi DESC, winrate DESC, wins DESC;

NOTIFY pgrst, 'reload schema';

SELECT * FROM public.tipster_ranking_live
ORDER BY profit DESC, roi DESC, winrate DESC, wins DESC
LIMIT 10;