-- BETAI SQL 821 — żywe zarobki twórcy
-- Uruchom w Supabase SQL Editor.
-- Źródłem prawdy jest public.earnings: sprzedaż typów + subskrypcje profilu.
-- Kwota amount = zarobek netto typera, commission = prowizja platformy, gross_amount = sprzedaż brutto.

ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS tip_id uuid;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS source text DEFAULT 'tip_purchase';
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
ALTER TABLE public.earnings ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

CREATE INDEX IF NOT EXISTS earnings_tipster_created_idx
ON public.earnings(tipster_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_tipster_earnings(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH source_rows AS (
    SELECT
      e.id,
      e.tipster_id,
      e.user_id,
      e.tip_id,
      COALESCE(e.gross_amount, e.amount + COALESCE(e.commission, 0), 0) AS gross_amount,
      COALESCE(e.amount, 0) AS amount,
      COALESCE(e.commission, 0) AS commission,
      COALESCE(e.source, 'tip_purchase') AS source,
      COALESCE(e.status, 'available') AS status,
      e.created_at
    FROM public.earnings e
    WHERE e.tipster_id = p_user_id
      AND COALESCE(e.status, 'available') IN ('available', 'paid', 'completed')
  )
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(amount), 0),
    'sales', COUNT(*),
    'available_to_payout', COALESCE(SUM(amount), 0),
    'history', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'tipster_id', tipster_id,
          'user_id', user_id,
          'tip_id', tip_id,
          'gross_amount', gross_amount,
          'amount', amount,
          'commission', commission,
          'source', source,
          'status', status,
          'created_at', created_at
        )
        ORDER BY created_at DESC
      ),
      '[]'::jsonb
    )
  )
  FROM source_rows;
$$;

GRANT EXECUTE ON FUNCTION public.get_tipster_earnings(uuid) TO authenticated;

-- Kontrola dla aktualnego konta:
SELECT public.get_tipster_earnings(
  (SELECT id FROM auth.users WHERE lower(email) = 'buchajson1988@gmail.com')
);
