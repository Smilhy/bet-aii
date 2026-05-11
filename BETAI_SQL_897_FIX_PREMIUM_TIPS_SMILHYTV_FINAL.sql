-- BETAI_SQL_897_FIX_PREMIUM_TIPS_SMILHYTV_FINAL.sql
-- FINALNA NAPRAWA: smilhytv może dodawać typy premium.
-- Naprawia sytuację, gdzie profiles pokazuje plan=premium, ale trigger tips dalej widzi konto jako FREE.
-- Uruchom CAŁOŚĆ w Supabase SQL Editor.

-- 1) Upewnij się, że profile ma wszystkie flagi używane przez stare i nowe triggery.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;

UPDATE public.profiles
SET
  username = COALESCE(NULLIF(username, ''), 'smilhytv'),
  is_admin = true,
  is_premium = true,
  role = 'admin',
  plan = 'premium',
  subscription_status = 'active',
  current_period_end = '2099-12-31 23:59:59+00'::timestamptz
WHERE
  lower(coalesce(username, '')) = 'smilhytv'
  OR lower(coalesce(email, '')) = 'smilhytv@gmail.com'
  OR lower(split_part(coalesce(email, ''), '@', 1)) = 'smilhytv';

-- 2) Funkcja statusu użytkownika: sprawdza po id, emailu, nicku i hardcoded smilhytv.
CREATE OR REPLACE FUNCTION public.betai_user_is_premium(
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_username text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(p_email, ''));
  v_username text := lower(coalesce(p_username, ''));
  v_found boolean := false;
BEGIN
  -- Hardcoded admin lifetime.
  IF v_email = 'smilhytv@gmail.com'
     OR split_part(v_email, '@', 1) = 'smilhytv'
     OR v_username = 'smilhytv'
  THEN
    RETURN true;
  END IF;

  -- Sprawdzenie auth.users, jeśli id pasuje tam zamiast profiles.
  IF p_user_id IS NOT NULL THEN
    BEGIN
      SELECT true
      INTO v_found
      FROM auth.users au
      WHERE au.id = p_user_id
        AND (
          lower(coalesce(au.email, '')) = 'smilhytv@gmail.com'
          OR lower(split_part(coalesce(au.email, ''), '@', 1)) = 'smilhytv'
          OR lower(coalesce(au.raw_user_meta_data->>'username', '')) = 'smilhytv'
          OR lower(coalesce(au.raw_user_meta_data->>'name', '')) = 'smilhytv'
        )
      LIMIT 1;

      IF coalesce(v_found, false) THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
      -- Pomijamy auth.users, jeśli brak dostępu.
      NULL;
    END;
  END IF;

  -- Sprawdzenie public.profiles.
  SELECT true
  INTO v_found
  FROM public.profiles p
  WHERE
    (
      p_user_id IS NOT NULL
      AND p.id = p_user_id
    )
    OR (
      v_email <> ''
      AND lower(coalesce(p.email, '')) = v_email
    )
    OR (
      v_username <> ''
      AND lower(coalesce(p.username, '')) = v_username
    )
    OR (
      lower(coalesce(p.email, '')) = 'smilhytv@gmail.com'
      OR lower(split_part(coalesce(p.email, ''), '@', 1)) = 'smilhytv'
      OR lower(coalesce(p.username, '')) = 'smilhytv'
    )
  AND (
    coalesce(p.is_admin, false) = true
    OR coalesce(p.is_premium, false) = true
    OR lower(coalesce(p.role, '')) = 'admin'
    OR lower(coalesce(p.plan, '')) IN ('premium', 'admin', 'vip', 'pro')
    OR lower(coalesce(p.subscription_status, '')) IN ('active', 'trialing', 'premium')
    OR coalesce(p.current_period_end, now() - interval '1 day') > now()
  )
  LIMIT 1;

  RETURN coalesce(v_found, false);
END;
$$;

-- Kompatybilność ze starszymi wersjami triggerów.
CREATE OR REPLACE FUNCTION public.is_betai_premium_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.betai_user_is_premium(p_user_id, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.betai_user_is_premium(p_user_id, NULL, NULL) THEN
    RETURN 'premium';
  END IF;
  RETURN 'free';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_tip(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tips_today integer := 0;
BEGIN
  IF public.betai_user_is_premium(p_user_id, NULL, NULL) THEN
    RETURN true;
  END IF;

  SELECT count(*)
  INTO tips_today
  FROM public.tips
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('day', now());

  RETURN tips_today < 5;
END;
$$;

-- 3) Trigger limitów FREE.
CREATE OR REPLACE FUNCTION public.enforce_tip_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := coalesce(NEW.user_id, NEW.author_id);
  NEW.author_id := coalesce(NEW.author_id, NEW.user_id);

  IF public.betai_user_is_premium(
    coalesce(NEW.user_id, NEW.author_id),
    NEW.author_email,
    coalesce(NEW.author_name, NEW.username)
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_add_tip(coalesce(NEW.user_id, NEW.author_id)) THEN
    RAISE EXCEPTION 'FREE_LIMIT: Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.';
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Trigger blokady premium — sprawdza także author_email/author_name.
CREATE OR REPLACE FUNCTION public.block_free_premium_tips()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium_tip boolean := false;
  v_author_id uuid;
  v_author_email text;
  v_author_name text;
BEGIN
  NEW.user_id := coalesce(NEW.user_id, NEW.author_id);
  NEW.author_id := coalesce(NEW.author_id, NEW.user_id);

  v_author_id := coalesce(NEW.user_id, NEW.author_id);
  v_author_email := coalesce(NEW.author_email, '');
  v_author_name := coalesce(NEW.author_name, NEW.username, '');

  v_is_premium_tip :=
    coalesce(NEW.is_premium, false) = true
    OR lower(coalesce(NEW.access_type, 'free')) IN ('premium', 'paid')
    OR coalesce(NEW.price, 0) > 0
    OR coalesce(NEW.single_price, 0) > 0
    OR coalesce(NEW.tip_price, 0) > 0;

  IF NOT v_is_premium_tip THEN
    RETURN NEW;
  END IF;

  IF public.betai_user_is_premium(v_author_id, v_author_email, v_author_name) THEN
    NEW.is_premium := true;
    NEW.access_type := 'premium';
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PREMIUM_REQUIRED: Tylko konta Premium mogą dodawać typy premium.';
END;
$$;

-- 5) Usuń stare triggerowe wersje i załóż jedną poprawną.
DROP TRIGGER IF EXISTS trigger_enforce_free_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_block_premium ON public.tips;
DROP TRIGGER IF EXISTS block_free_premium_tips_trigger ON public.tips;

CREATE TRIGGER trigger_tip_limit
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tip_limit();

CREATE TRIGGER trigger_block_premium
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.block_free_premium_tips();

-- 6) Reload PostgREST cache.
NOTIFY pgrst, 'reload schema';

-- 7) Kontrola.
SELECT
  id,
  email,
  username,
  is_admin,
  is_premium,
  role,
  plan,
  subscription_status,
  current_period_end,
  public.betai_user_is_premium(id, email, username) AS betai_premium_check,
  public.get_user_status(id) AS betai_status
FROM public.profiles
WHERE
  lower(coalesce(username, '')) = 'smilhytv'
  OR lower(coalesce(email, '')) = 'smilhytv@gmail.com'
  OR lower(split_part(coalesce(email, ''), '@', 1)) = 'smilhytv';