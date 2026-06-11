-- =========================================
-- WERSJA 309 - REALNY SYSTEM PREMIUM / FREE
-- Dziala dla kazdego nowego uzytkownika, ktory kupi Premium.
-- =========================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

INSERT INTO public.profiles (id, email, username, is_admin, is_premium, plan, subscription_status)
SELECT u.id, u.email, SPLIT_PART(u.email, '@', 1), FALSE, FALSE, 'free', 'free'
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
  VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1), FALSE, FALSE, 'free', 'free')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

UPDATE public.profiles
SET is_admin = TRUE, is_premium = TRUE, plan = 'premium', subscription_status = 'active'
WHERE email = 'smilhytv@gmail.com' OR username = 'smilhytv';

UPDATE public.profiles
SET is_admin = FALSE, is_premium = TRUE, plan = 'premium', subscription_status = 'active'
WHERE email = 'buchajson1988@gmail.com' OR username = 'buchajson1988';

UPDATE public.profiles
SET is_admin = FALSE, is_premium = FALSE, plan = 'free', subscription_status = 'free'
WHERE email IN ('buchajsonek1988@gmail.com', 'buchajtv@gmail.com', 'p.kucharski@aol.co.uk');

DROP VIEW IF EXISTS public.profiles_with_status;
DROP FUNCTION IF EXISTS public.get_user_status(UUID);

CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_is_admin BOOLEAN := FALSE;
  v_is_premium BOOLEAN := FALSE;
  v_plan TEXT := 'free';
  v_subscription_status TEXT := 'free';
  v_has_active_subscription BOOLEAN := FALSE;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  SELECT COALESCE(is_admin, FALSE), COALESCE(is_premium, FALSE), LOWER(COALESCE(plan, 'free')), LOWER(COALESCE(subscription_status, 'free'))
  INTO v_is_admin, v_is_premium, v_plan, v_subscription_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF LOWER(COALESCE(v_email, '')) = 'smilhytv@gmail.com' THEN RETURN 'admin'; END IF;
  IF LOWER(COALESCE(v_email, '')) = 'buchajson1988@gmail.com' THEN RETURN 'premium'; END IF;
  IF v_is_admin THEN RETURN 'admin'; END IF;
  IF v_is_premium OR v_plan IN ('premium', 'vip', 'admin') OR v_subscription_status IN ('active', 'trialing', 'premium') THEN RETURN 'premium'; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_subscriptions') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_subscriptions us
      WHERE us.user_id = p_user_id
        AND (LOWER(COALESCE(us.plan, '')) = 'premium' OR LOWER(COALESCE(us.status, '')) IN ('active', 'trialing'))
        AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
    ) INTO v_has_active_subscription;
    IF v_has_active_subscription THEN RETURN 'premium'; END IF;
  END IF;

  RETURN 'free';
END;
$$;

CREATE VIEW public.profiles_with_status AS
SELECT p.id, p.email, p.username, p.is_admin, p.is_premium, p.plan, p.subscription_status, public.get_user_status(p.id) AS status
FROM public.profiles p;

DROP TRIGGER IF EXISTS trigger_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_block_premium ON public.tips;
DROP FUNCTION IF EXISTS public.enforce_tip_limit();
DROP FUNCTION IF EXISTS public.block_free_premium_tips();
DROP FUNCTION IF EXISTS public.can_add_tip(UUID);

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
  WHERE user_id = p_user_id AND created_at >= date_trunc('day', NOW());

  RETURN tips_today < 5;
END;
$$;

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
  IF public.get_user_status(NEW.user_id) = 'free' AND COALESCE(NEW.is_premium, FALSE) = TRUE THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_block_premium
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.block_free_premium_tips();

SELECT email, username, public.get_user_status(id) AS status, is_admin, is_premium, plan, subscription_status
FROM public.profiles
ORDER BY status, username;
