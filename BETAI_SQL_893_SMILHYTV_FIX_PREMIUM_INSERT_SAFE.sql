-- BETAI_SQL_893_SMILHYTV_FIX_PREMIUM_INSERT_SAFE.sql
-- Bezpieczna poprawka: smilhytv = Premium lifetime + admin.
-- Użyj tego wariantu, jeśli user_subscriptions ma FK do public.users.

DO $$
DECLARE
  v_profile_id uuid;
  v_user_id uuid;
  v_has_user_subscriptions boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE NOTICE 'Tabela public.profiles nie istnieje — pomijam.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_premium'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_premium boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN plan text DEFAULT 'free';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_status text DEFAULT 'inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'current_period_end'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN current_period_end timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text;
  END IF;

  SELECT id
  INTO v_profile_id
  FROM public.profiles
  WHERE
    lower(coalesce(username, '')) = 'smilhytv'
    OR lower(coalesce(email, '')) = 'smilhytv@gmail.com'
    OR lower(split_part(coalesce(email, ''), '@', 1)) = 'smilhytv'
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'Nie znaleziono profilu smilhytv w public.profiles.';
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    username = COALESCE(NULLIF(username, ''), 'smilhytv'),
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active',
    current_period_end = '2099-12-31 23:59:59+00'::timestamptz,
    role = 'admin'
  WHERE id = v_profile_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
  ) INTO v_has_user_subscriptions;

  IF v_has_user_subscriptions AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    SELECT u.id
    INTO v_user_id
    FROM public.users u
    JOIN public.profiles p
      ON lower(coalesce(u.email, '')) = lower(coalesce(p.email, ''))
      OR u.id = p.id
    WHERE p.id = v_profile_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user_id) THEN
        UPDATE public.user_subscriptions
        SET
          plan = 'premium',
          status = 'active',
          current_period_end = '2099-12-31 23:59:59+00'::timestamptz
        WHERE user_id = v_user_id;
      ELSE
        INSERT INTO public.user_subscriptions (user_id, plan, status, current_period_end)
        VALUES (v_user_id, 'premium', 'active', '2099-12-31 23:59:59+00'::timestamptz);
      END IF;
    ELSE
      RAISE NOTICE 'Nie znaleziono pasującego public.users.id — pomijam user_subscriptions.';
    END IF;
  END IF;

  RAISE NOTICE 'smilhytv ustawiony jako Premium/Admin lifetime.';
END $$;

SELECT
  id,
  email,
  username,
  role,
  plan,
  subscription_status,
  is_premium,
  current_period_end
FROM public.profiles
WHERE
  lower(coalesce(username, '')) = 'smilhytv'
  OR lower(coalesce(email, '')) = 'smilhytv@gmail.com'
  OR lower(split_part(coalesce(email, ''), '@', 1)) = 'smilhytv';