-- =========================================
-- WERSJA 312 - STRIPE WALLET TOP-UP / SALDO FIX
-- =========================================
-- Uruchom w Supabase SQL Editor: Run without RLS.
-- Naprawia: testowa/prawdziwa płatność Stripe dopisuje saldo po checkout.session.completed
-- oraz po ręcznym syncu z powrotu na stronę (?wallet_topup=success&session_id=...).

-- 1. Portfel: tabela transakcji jako źródło prawdy
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

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe';

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS provider_session_id text;

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_provider_session_uidx
ON public.wallet_transactions(provider_session_id)
WHERE provider_session_id IS NOT NULL;

-- 2. Funkcja salda używana przez frontend
CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN status <> 'completed' THEN 0
      WHEN type IN ('spend', 'purchase', 'tip_purchase', 'withdrawal', 'payout') THEN -ABS(amount)
      ELSE ABS(amount)
    END
  ), 0)::numeric(12,2)
  FROM public.wallet_transactions
  WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO anon;

-- 3. Helper kompatybilności: jeśli masz starą kolumnę profiles.wallet, aktualizuje ją także.
CREATE OR REPLACE FUNCTION public.apply_wallet_topup_to_profile(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'wallet'
  ) THEN
    UPDATE public.profiles
    SET wallet = COALESCE(wallet, 0) + COALESCE(p_amount, 0)
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_wallet_topup_to_profile(uuid, numeric) TO service_role;

-- 4. RLS: user może czytać swoje transakcje; backend service_role zapisuje transakcje.
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users read own wallet transactions"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. Upewnij się, że profiles istnieją dla kont z auth.users.
INSERT INTO public.profiles (id, email, username, is_admin, is_premium)
SELECT
  u.id,
  u.email,
  SPLIT_PART(u.email, '@', 1),
  FALSE,
  FALSE
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- DEBUG:
-- SELECT email, public.get_wallet_balance(id) AS saldo FROM public.profiles ORDER BY email;
-- SELECT * FROM public.wallet_transactions ORDER BY created_at DESC LIMIT 20;
