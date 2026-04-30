-- Wersja 302 — Ultra Pro: twarda blokada limitu FREE i premium w Supabase
-- Uruchom w Supabase SQL Editor, jeśli chcesz odświeżyć logikę blokad po deployu.

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

  IF NEW.access_type IN ('premium','paid') AND v_is_premium = false AND v_is_admin = false THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: Nie posiadasz konta premium.';
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
    RAISE EXCEPTION 'FREE_LIMIT: Osiągnąłeś maksymalny limit 5 typów dziennie.';
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
