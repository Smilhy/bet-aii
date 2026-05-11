-- BETAI_SQL_893_SMILHYTV_FIX_PREMIUM_INSERT.sql
-- Naprawa dodawania typów premium dla smilhytv.
-- Ważne: plan ustawiamy na 'premium', a rolę na 'admin',
-- bo część triggerów/RLS w bazie sprawdza dokładnie plan = 'premium'.
-- Uruchom w Supabase SQL Editor.

DO $$
DECLARE
  v_profile_id uuid;
  v_email text;
  v_username text;
  v_has_profiles boolean;
  v_has_user_subscriptions boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO v_has_profiles;

  IF NOT v_has_profiles THEN
    RAISE NOTICE 'Tabela public.profiles nie istnieje — pomijam.';
    RETURN;
  END IF;

  -- Kolumny profilu, jeżeli ich brakuje.
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

  -- Znajdź smilhytv.
  SELECT id, email, username
  INTO v_profile_id, v_email, v_username
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

  -- Najważniejsze: plan = premium, role = admin.
  UPDATE public.profiles
  SET
    username = COALESCE(NULLIF(username, ''), 'smilhytv'),
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active',
    current_period_end = '2099-12-31 23:59:59+00'::timestamptz,
    role = 'admin'
  WHERE id = v_profile_id;

  -- Jeżeli istnieje tabela user_subscriptions, też ustawiamy premium.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
  ) INTO v_has_user_subscriptions;

  IF v_has_user_subscriptions THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_subscriptions' AND column_name = 'plan'
    ) THEN
      ALTER TABLE public.user_subscriptions ADD COLUMN plan text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_subscriptions' AND column_name = 'status'
    ) THEN
      ALTER TABLE public.user_subscriptions ADD COLUMN status text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_subscriptions' AND column_name = 'current_period_end'
    ) THEN
      ALTER TABLE public.user_subscriptions ADD COLUMN current_period_end timestamptz;
    END IF;

    -- Aktualizuj istniejący rekord albo wstaw nowy.
    IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = v_profile_id) THEN
      UPDATE public.user_subscriptions
      SET
        plan = 'premium',
        status = 'active',
        current_period_end = '2099-12-31 23:59:59+00'::timestamptz
      WHERE user_id = v_profile_id;
    ELSE
      INSERT INTO public.user_subscriptions (
        user_id,
        plan,
        status,
        current_period_end
      )
      VALUES (
        v_profile_id,
        'premium',
        'active',
        '2099-12-31 23:59:59+00'::timestamptz
      );
    END IF;
  END IF;

  RAISE NOTICE 'smilhytv ustawiony jako role=admin, plan=premium, subscription active do 2099.';
END $$;

-- Kontrola profilu:
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

-- Kontrola subskrypcji, jeśli tabela istnieje:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
  ) THEN
    RAISE NOTICE 'Sprawdź public.user_subscriptions poniższym SELECT-em:';
  END IF;
END $$;

SELECT
  us.*
FROM public.user_subscriptions us
JOIN public.profiles p ON p.id = us.user_id
WHERE
  lower(coalesce(p.username, '')) = 'smilhytv'
  OR lower(coalesce(p.email, '')) = 'smilhytv@gmail.com'
  OR lower(split_part(coalesce(p.email, ''), '@', 1)) = 'smilhytv';