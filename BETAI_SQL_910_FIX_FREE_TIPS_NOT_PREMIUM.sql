-- BETAI_SQL_910_FIX_FREE_TIPS_NOT_PREMIUM.sql
-- Naprawia błąd: darmowy typ dodany przez Premium/Admin nie może automatycznie zmieniać się w premium.
-- Premium/Admin nadal może dodawać typy premium.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_id uuid;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_email text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS access_type text DEFAULT 'free';
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS access text DEFAULT 'free';
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS single_price numeric DEFAULT 0;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS tip_price numeric DEFAULT 0;

UPDATE public.profiles
SET
  username = 'smilhytv',
  is_admin = true,
  is_premium = true,
  role = 'admin',
  plan = 'premium',
  subscription_status = 'active',
  current_period_end = '2099-12-31 23:59:59+00'::timestamptz
WHERE lower(coalesce(email, '')) = 'smilhytv@gmail.com'
   OR lower(coalesce(username, '')) = 'smilhytv'
   OR lower(split_part(coalesce(email, ''), '@', 1)) = 'smilhytv';

DROP TRIGGER IF EXISTS trigger_block_premium ON public.tips;
DROP TRIGGER IF EXISTS block_free_premium_tips_trigger ON public.tips;
DROP TRIGGER IF EXISTS trigger_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS trigger_enforce_free_tip_limit ON public.tips;
DROP TRIGGER IF EXISTS betai_tip_limit_trigger ON public.tips;

-- Napraw stare rekordy, które są oznaczone jako premium, ale mają cenę 0.
UPDATE public.tips
SET
  is_premium = false,
  access_type = 'free',
  access = 'free',
  price = 0,
  single_price = 0,
  tip_price = 0
WHERE
  coalesce(price, 0) = 0
  AND coalesce(single_price, 0) = 0
  AND coalesce(tip_price, 0) = 0
  AND (
    coalesce(is_premium, false) = true
    OR lower(coalesce(access_type, 'free')) = 'premium'
    OR lower(coalesce(access, 'free')) = 'premium'
  );

CREATE OR REPLACE FUNCTION public.betai_current_auth_email_safe()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := '';
  v_claims jsonb;
BEGIN
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
    v_email := lower(coalesce(v_claims->>'email', ''));
    IF v_email <> '' THEN RETURN v_email; END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    SELECT lower(coalesce(email, ''))
    INTO v_email
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
    IF coalesce(v_email, '') <> '' THEN RETURN v_email; END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.betai_user_is_premium_safe(
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_username text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(coalesce(p_email, ''));
  v_username text := lower(coalesce(p_username, ''));
  v_auth_email text := public.betai_current_auth_email_safe();
  v_uid uuid := auth.uid();
  v_result boolean := false;
BEGIN
  IF v_email = 'smilhytv@gmail.com'
     OR split_part(v_email, '@', 1) = 'smilhytv'
     OR v_username = 'smilhytv'
     OR v_auth_email = 'smilhytv@gmail.com'
     OR split_part(v_auth_email, '@', 1) = 'smilhytv'
  THEN
    RETURN true;
  END IF;

  SELECT true
  INTO v_result
  FROM public.profiles p
  WHERE
    (
      (p_user_id IS NOT NULL AND p.id = p_user_id)
      OR (v_uid IS NOT NULL AND p.id = v_uid)
      OR (v_email <> '' AND lower(coalesce(p.email, '')) = v_email)
      OR (v_auth_email <> '' AND lower(coalesce(p.email, '')) = v_auth_email)
      OR (v_username <> '' AND lower(coalesce(p.username, '')) = v_username)
    )
    AND (
      coalesce(p.is_admin, false) = true
      OR coalesce(p.is_premium, false) = true
      OR lower(coalesce(p.role, '')) = 'admin'
      OR lower(coalesce(p.plan, '')) IN ('premium', 'admin', 'pro', 'vip')
      OR lower(coalesce(p.subscription_status, '')) IN ('active', 'premium', 'trialing')
      OR coalesce(p.current_period_end, now() - interval '1 day') > now()
    )
  LIMIT 1;

  RETURN coalesce(v_result, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_tip(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  tips_today integer := 0;
BEGIN
  IF public.betai_user_is_premium_safe(p_user_id, NULL, NULL) THEN
    RETURN true;
  END IF;

  SELECT count(*)
  INTO tips_today
  FROM public.tips
  WHERE (user_id = p_user_id OR author_id = p_user_id)
    AND created_at >= date_trunc('day', now());

  RETURN tips_today < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_tip_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payload jsonb := to_jsonb(NEW);
  v_author_id uuid;
  v_author_email text;
  v_author_name text;
BEGIN
  v_author_id := COALESCE(NULLIF(v_payload->>'user_id', '')::uuid, NULLIF(v_payload->>'author_id', '')::uuid, auth.uid());
  v_author_email := lower(coalesce(v_payload->>'author_email', v_payload->>'email', public.betai_current_auth_email_safe(), ''));
  v_author_name := lower(coalesce(v_payload->>'author_name', v_payload->>'username', ''));

  IF public.betai_user_is_premium_safe(v_author_id, v_author_email, v_author_name) THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_add_tip(v_author_id) THEN
    RAISE EXCEPTION 'FREE_LIMIT: Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_free_premium_tips()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payload jsonb := to_jsonb(NEW);
  v_author_id uuid;
  v_author_email text;
  v_author_name text;
  v_is_premium_tip boolean := false;
BEGIN
  v_author_id := COALESCE(NULLIF(v_payload->>'user_id', '')::uuid, NULLIF(v_payload->>'author_id', '')::uuid, auth.uid());
  v_author_email := lower(coalesce(v_payload->>'author_email', v_payload->>'email', public.betai_current_auth_email_safe(), ''));
  v_author_name := lower(coalesce(v_payload->>'author_name', v_payload->>'username', ''));

  v_is_premium_tip :=
    coalesce((v_payload->>'is_premium')::boolean, false) = true
    OR lower(coalesce(v_payload->>'access_type', v_payload->>'access', 'free')) IN ('premium', 'paid')
    OR coalesce(NULLIF(v_payload->>'price', '')::numeric, 0) > 0
    OR coalesce(NULLIF(v_payload->>'single_price', '')::numeric, 0) > 0
    OR coalesce(NULLIF(v_payload->>'tip_price', '')::numeric, 0) > 0;

  -- Najważniejsze: darmowy typ zawsze zostaje darmowy, nawet gdy autor jest Premium/Admin.
  IF NOT v_is_premium_tip THEN
    NEW.is_premium := false;
    NEW.access_type := 'free';
    NEW.access := 'free';
    NEW.price := 0;
    NEW.single_price := 0;
    NEW.tip_price := 0;
    RETURN NEW;
  END IF;

  IF public.betai_user_is_premium_safe(v_author_id, v_author_email, v_author_name) THEN
    NEW.is_premium := true;
    NEW.access_type := 'premium';
    NEW.access := 'premium';
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PREMIUM_REQUIRED: Tylko konta Premium mogą dodawać typy premium.';
END;
$$;

CREATE TRIGGER trigger_tip_limit
BEFORE INSERT ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tip_limit();

CREATE TRIGGER trigger_block_premium
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.block_free_premium_tips();

NOTIFY pgrst, 'reload schema';

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
  public.betai_user_is_premium_safe(id, email, username) AS premium_check
FROM public.profiles
WHERE lower(coalesce(email, '')) = 'smilhytv@gmail.com'
   OR lower(coalesce(username, '')) = 'smilhytv';

SELECT
  tg.tgname AS trigger_name,
  fn.proname AS function_name
FROM pg_trigger tg
JOIN pg_class tbl ON tbl.oid = tg.tgrelid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
JOIN pg_proc fn ON fn.oid = tg.tgfoid
WHERE ns.nspname = 'public'
  AND tbl.relname = 'tips'
  AND NOT tg.tgisinternal
ORDER BY tg.tgname;