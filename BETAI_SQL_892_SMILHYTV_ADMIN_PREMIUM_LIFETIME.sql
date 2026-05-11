-- BETAI_SQL_892_SMILHYTV_ADMIN_PREMIUM_LIFETIME.sql
-- Nadaje użytkownikowi smilhytv dożywotnie uprawnienia Premium/Admin,
-- żeby mógł dodawać płatne typy premium.
-- Uruchom w Supabase SQL Editor.

DO $$
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

  UPDATE public.profiles
  SET
    username = COALESCE(NULLIF(username, ''), 'smilhytv'),
    is_premium = true,
    plan = 'admin',
    subscription_status = 'active',
    current_period_end = '2099-12-31 23:59:59+00'::timestamptz,
    role = 'admin'
  WHERE
    lower(coalesce(username, '')) = 'smilhytv'
    OR lower(coalesce(email, '')) = 'smilhytv@gmail.com'
    OR lower(split_part(coalesce(email, ''), '@', 1)) = 'smilhytv';

  RAISE NOTICE 'smilhytv ustawiony jako ADMIN/PREMIUM lifetime w public.profiles.';
END $$;

-- Kontrola:
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