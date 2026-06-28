-- BETAI v301 — limity free/premium + czytelne komunikaty UI
-- Uruchom w Supabase SQL Editor po deployu wersji 301.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

UPDATE public.profiles
SET is_admin = true, is_premium = true
WHERE lower(email) = 'smilhytv@gmail.com';

ALTER TABLE public.tips
ADD COLUMN IF NOT EXISTS access_type text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.enforce_free_tip_limit()
RETURNS trigger AS $$
DECLARE
  v_is_premium boolean := false;
  v_is_admin boolean := false;
  v_today_count integer := 0;
BEGIN
  SELECT
    COALESCE(is_premium, false),
    COALESCE(is_admin, false)
  INTO v_is_premium, v_is_admin
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF NEW.access_type IN ('premium','paid') AND COALESCE(v_is_premium, false) = false AND COALESCE(v_is_admin, false) = false THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.';
  END IF;

  IF COALESCE(v_is_premium, false) = true OR COALESCE(v_is_admin, false) = true THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_enforce_free_tip_limit ON public.tips;

CREATE TRIGGER trigger_enforce_free_tip_limit
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_tip_limit();

NOTIFY pgrst, 'reload schema';
