-- =========================================
-- WERSJA 311 - STRIPE + PREMIUM VERIFIED FIX
-- Uruchom w Supabase SQL Editor: Run without RLS
-- =========================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive';
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DELETE FROM public.user_subscriptions a
USING public.user_subscriptions b
WHERE a.user_id = b.user_id
  AND a.id <> b.id
  AND COALESCE(a.updated_at, a.created_at, NOW()) < COALESCE(b.updated_at, b.created_at, NOW());

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_id_uidx ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_customer_idx ON public.user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_subscription_idx ON public.user_subscriptions(stripe_subscription_id);

INSERT INTO public.profiles (id, email, username, is_admin, is_premium, plan, subscription_status)
SELECT u.id, LOWER(u.email), SPLIT_PART(LOWER(u.email), '@', 1), FALSE, FALSE, 'free', 'free'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, is_admin, is_premium, plan, subscription_status)
  VALUES (NEW.id, LOWER(NEW.email), SPLIT_PART(LOWER(NEW.email), '@', 1), FALSE, FALSE, 'free', 'free')
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
DROP TRIGGER IF EXISTS trigger_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

UPDATE public.profiles
SET is_admin = TRUE, is_premium = TRUE, plan = 'premium', subscription_status = 'active', updated_at = NOW()
WHERE LOWER(email) = 'smilhytv@gmail.com' OR LOWER(username) = 'smilhytv';

UPDATE public.profiles
SET is_admin = FALSE, is_premium = TRUE, plan = 'premium', subscription_status = 'active', updated_at = NOW()
WHERE LOWER(email) = 'buchajson1988@gmail.com' OR LOWER(username) = 'buchajson1988';

UPDATE public.profiles
SET is_admin = FALSE, is_premium = FALSE, plan = 'free', subscription_status = 'free', updated_at = NOW()
WHERE LOWER(email) IN ('buchajsonek1988@gmail.com', 'buchajtv@gmail.com', 'p.kucharski@aol.co.uk');

DROP VIEW IF EXISTS public.profiles_with_status;
DROP FUNCTION IF EXISTS public.get_final_user_status(UUID);
DROP FUNCTION IF EXISTS public.get_user_status(UUID);

CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := '';
  v_is_admin BOOLEAN := FALSE;
  v_is_premium BOOLEAN := FALSE;
  v_plan TEXT := 'free';
  v_subscription_status TEXT := 'free';
  v_has_active_subscription BOOLEAN := FALSE;
BEGIN
  SELECT LOWER(COALESCE(email, '')) INTO v_email FROM auth.users WHERE id = p_user_id;

  SELECT COALESCE(is_admin, FALSE), COALESCE(is_premium, FALSE), LOWER(COALESCE(plan, 'free')), LOWER(COALESCE(subscription_status, 'free'))
  INTO v_is_admin, v_is_premium, v_plan, v_subscription_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_email = 'smilhytv@gmail.com' THEN RETURN 'admin'; END IF;
  IF v_email = 'buchajson1988@gmail.com' THEN RETURN 'premium'; END IF;
  IF v_is_admin THEN RETURN 'admin'; END IF;
  IF v_is_premium OR v_plan IN ('premium', 'vip', 'admin') OR v_subscription_status IN ('active', 'trialing', 'premium') THEN RETURN 'premium'; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND (LOWER(COALESCE(us.plan, '')) = 'premium' OR LOWER(COALESCE(us.status, '')) IN ('active', 'trialing'))
      AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
  ) INTO v_has_active_subscription;

  IF v_has_active_subscription THEN RETURN 'premium'; END IF;
  RETURN 'free';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_final_user_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_status(p_user_id);
$$;

CREATE VIEW public.profiles_with_status AS
SELECT p.id, p.email, p.username, p.is_admin, p.is_premium, p.plan, p.subscription_status, public.get_user_status(p.id) AS status
FROM public.profiles p;

DROP TRIGGER IF EXISTS trigger_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_real_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_final_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_block_premium ON public.tips;
DROP TRIGGER IF EXISTS trigger_block_real_premium ON public.tips;
DROP TRIGGER IF EXISTS trigger_block_final_premium ON public.tips;

DROP FUNCTION IF EXISTS public.enforce_tip_limit();
DROP FUNCTION IF EXISTS public.enforce_real_tip_limit();
DROP FUNCTION IF EXISTS public.enforce_final_tip_limit();
DROP FUNCTION IF EXISTS public.block_free_premium_tips();
DROP FUNCTION IF EXISTS public.block_free_real_premium_tips();
DROP FUNCTION IF EXISTS public.block_free_premium_final();
DROP FUNCTION IF EXISTS public.can_add_tip(UUID);
DROP FUNCTION IF EXISTS public.can_user_add_tip(UUID);
DROP FUNCTION IF EXISTS public.can_add_tip_final(UUID);

CREATE OR REPLACE FUNCTION public.can_add_tip(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tips_today INTEGER := 0;
BEGIN
  IF public.get_user_status(p_user_id) IN ('admin', 'premium') THEN RETURN TRUE; END IF;

  SELECT COUNT(*) INTO tips_today
  FROM public.tips
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('day', NOW());

  RETURN tips_today < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_tip_final(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.can_add_tip(p_user_id); $$;

CREATE OR REPLACE FUNCTION public.enforce_tip_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_add_tip(NEW.user_id) THEN
    RAISE EXCEPTION 'FREE_TIP_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_tip_limit
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tip_limit();

CREATE OR REPLACE FUNCTION public.block_free_premium_tips()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_status(NEW.user_id) = 'free' AND LOWER(COALESCE(NEW.access_type, 'free')) = 'premium' THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_block_premium
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.block_free_premium_tips();

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users read own subscription"
ON public.user_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

SELECT
  p.email,
  p.username,
  public.get_user_status(p.id) AS status,
  p.is_admin,
  p.is_premium,
  p.plan,
  p.subscription_status,
  us.plan AS subscription_plan,
  us.status AS subscription_status_real
FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
ORDER BY status, p.email;
