-- Wersja 303 — naprawa limitów FREE/Premium/Admin dla dodawania typów
-- Uruchom w Supabase SQL Editor po deployu.

CREATE OR REPLACE FUNCTION public.enforce_free_tip_limit()
RETURNS trigger AS $$
DECLARE
  v_is_premium boolean := false;
  v_is_admin boolean := false;
  v_today_count integer := 0;
  v_email text := '';
BEGIN
  SELECT
    COALESCE(p.is_premium, false)
      OR COALESCE(p.plan = 'premium', false)
      OR COALESCE(p.subscription_status IN ('active','trialing'), false),
    COALESCE(p.is_admin, false),
    COALESCE(p.email, '')
  INTO v_is_premium, v_is_admin, v_email
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF lower(COALESCE(v_email, '')) = 'smilhytv@gmail.com' THEN
    v_is_admin := true;
    v_is_premium := true;
  END IF;

  IF NEW.access_type IN ('premium','paid') AND v_is_premium = false AND v_is_admin = false THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.';
  END IF;

  IF v_is_premium = true OR v_is_admin = true THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_today_count
  FROM public.tips
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('day', now());

  IF v_today_count >= 5 THEN
    RAISE EXCEPTION 'FREE_LIMIT: Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_enforce_free_tip_limit ON public.tips;
CREATE TRIGGER trigger_enforce_free_tip_limit
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_tip_limit();

CREATE OR REPLACE FUNCTION public.block_free_premium_tips()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author uuid;
  row_data jsonb;
  is_tip_premium boolean;
  v_is_premium boolean := false;
  v_is_admin boolean := false;
  v_email text := '';
BEGIN
  row_data := to_jsonb(NEW);

  author := COALESCE(
    NULLIF(row_data ->> 'user_id', '')::uuid,
    NULLIF(row_data ->> 'author_id', '')::uuid,
    NULLIF(row_data ->> 'tipster_id', '')::uuid,
    NULLIF(row_data ->> 'profile_id', '')::uuid,
    NULLIF(row_data ->> 'owner_id', '')::uuid
  );

  is_tip_premium := COALESCE((row_data ->> 'is_premium')::boolean, false)
    OR COALESCE(row_data ->> 'access_type', 'free') IN ('premium','paid');

  IF NOT is_tip_premium THEN
    RETURN NEW;
  END IF;

  IF author IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(p.is_premium, false)
      OR COALESCE(p.plan = 'premium', false)
      OR COALESCE(p.subscription_status IN ('active','trialing'), false),
    COALESCE(p.is_admin, false),
    COALESCE(p.email, '')
  INTO v_is_premium, v_is_admin, v_email
  FROM public.profiles p
  WHERE p.id = author;

  IF lower(COALESCE(v_email, '')) = 'smilhytv@gmail.com' THEN
    v_is_admin := true;
    v_is_premium := true;
  END IF;

  IF v_is_premium = false AND v_is_admin = false THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_free_premium_tips_trigger ON public.tips;
CREATE TRIGGER block_free_premium_tips_trigger
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.block_free_premium_tips();

UPDATE public.profiles
SET is_admin = true,
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active'
WHERE lower(email) = 'smilhytv@gmail.com';

NOTIFY pgrst, 'reload schema';
