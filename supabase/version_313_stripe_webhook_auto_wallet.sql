-- =========================================
-- WERSJA 313 - STRIPE WEBHOOK → AUTO SALDO
-- =========================================
-- Uruchom w Supabase SQL Editor: Run without RLS.
-- Po checkout.session.completed Netlify webhook automatycznie dopisuje saldo.
-- Ta sama sesja Stripe nie doda salda drugi raz.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS balance numeric(12,2) DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  type text NOT NULL DEFAULT 'topup',
  provider text DEFAULT 'stripe',
  provider_session_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS provider_session_id text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_provider_session_uidx
ON public.wallet_transactions(provider_session_id)
WHERE provider_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2),
  currency text DEFAULT 'PLN',
  type text DEFAULT 'deposit',
  stripe_session_id text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_transactions_stripe_session_uidx
ON public.user_transactions(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_wallet_topup_final(
  p_user_id uuid,
  p_amount numeric,
  p_session_id text,
  p_email text DEFAULT NULL
)
RETURNS TABLE(balance numeric, already_processed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
  v_email text := lower(nullif(trim(p_email), ''));
  v_username text := 'user';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid wallet amount';
  END IF;

  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RAISE EXCEPTION 'Missing Stripe session id';
  END IF;

  IF v_email IS NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_user_id;
  END IF;

  v_username := COALESCE(split_part(v_email, '@', 1), 'user');

  INSERT INTO public.profiles (id, email, username, is_admin, is_premium, balance, updated_at)
  VALUES (p_user_id, v_email, v_username, false, false, 0, now())
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    balance = COALESCE(public.profiles.balance, 0),
    updated_at = now();

  INSERT INTO public.wallet_transactions (user_id, amount, type, provider, provider_session_id, status)
  VALUES (p_user_id, round(p_amount::numeric, 2), 'topup', 'stripe', p_session_id, 'completed')
  ON CONFLICT (provider_session_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE public.profiles
    SET balance = COALESCE(balance, 0) + round(p_amount::numeric, 2),
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.user_transactions (user_id, amount, currency, type, stripe_session_id)
    VALUES (p_user_id, round(p_amount::numeric, 2), 'PLN', 'deposit', p_session_id)
    ON CONFLICT (stripe_session_id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT COALESCE(p.balance, 0)::numeric(12,2), (v_rows = 0)
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_wallet_topup_final(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_wallet_topup_final(uuid, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_balance_safe(
  p_user_id uuid,
  p_amount numeric,
  p_session_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_wallet_topup_final(p_user_id, p_amount, p_session_id, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_balance_safe(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_balance_safe(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(balance, 0)::numeric(12,2)
  FROM public.profiles
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO service_role;

DROP VIEW IF EXISTS public.wallet_debug_view;
CREATE VIEW public.wallet_debug_view AS
SELECT
  p.id,
  p.email,
  p.username,
  COALESCE(p.balance, 0)::numeric(12,2) AS balance,
  COUNT(w.id) AS wallet_transactions,
  MAX(w.created_at) AS last_transaction_at
FROM public.profiles p
LEFT JOIN public.wallet_transactions w ON w.user_id = p.id
GROUP BY p.id, p.email, p.username, p.balance;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users read own wallet transactions"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- DEBUG:
-- SELECT * FROM public.wallet_debug_view ORDER BY email;
-- SELECT * FROM public.wallet_transactions ORDER BY created_at DESC LIMIT 20;
