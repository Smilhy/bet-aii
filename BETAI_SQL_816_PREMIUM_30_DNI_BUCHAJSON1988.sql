-- BETAI_SQL_816_PREMIUM_30_DNI_BUCHAJSON1988.sql
-- Uruchom w Supabase SQL Editorze.
-- Cel:
-- 1) przypisać Premium na 30 dni od momentu uruchomienia dla buchajson1988@gmail.com / buchajson1988,
-- 2) po upływie current_period_end konto wraca logicznie do FREE,
-- 3) admin smilhytv nadal ma stały status ADMIN.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free';

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id uuid PRIMARY KEY,
  plan text DEFAULT 'free',
  status text DEFAULT 'free',
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz DEFAULT now()
);

-- Admin zostaje adminem bez ograniczenia czasu.
UPDATE public.profiles
SET is_admin = true,
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active'
WHERE lower(email) = 'smilhytv@gmail.com' OR lower(username) = 'smilhytv';

-- Buchajson1988: Premium od dziś na 30 dni.
WITH target_user AS (
  SELECT id
  FROM public.profiles
  WHERE lower(email) = 'buchajson1988@gmail.com' OR lower(username) = 'buchajson1988'
  LIMIT 1
)
UPDATE public.profiles p
SET is_admin = false,
    is_premium = true,
    plan = 'premium',
    subscription_status = 'active',
    current_period_end = now() + interval '30 days'
FROM target_user t
WHERE p.id = t.id;

WITH target_user AS (
  SELECT id
  FROM public.profiles
  WHERE lower(email) = 'buchajson1988@gmail.com' OR lower(username) = 'buchajson1988'
  LIMIT 1
)
INSERT INTO public.user_subscriptions (user_id, plan, status, current_period_end, cancel_at_period_end, updated_at)
SELECT id, 'premium', 'active', now() + interval '30 days', false, now()
FROM target_user
ON CONFLICT (user_id) DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  updated_at = now();

-- Status czytany z bazy: po current_period_end konto nie jest już Premium.
CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_username text;
  v_is_admin boolean := false;
  v_profile_active boolean := false;
  v_subscription_active boolean := false;
BEGIN
  SELECT lower(coalesce(email, '')), lower(coalesce(username, '')), coalesce(is_admin, false)
  INTO v_email, v_username, v_is_admin
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_email = 'smilhytv@gmail.com' OR v_username = 'smilhytv' OR v_is_admin THEN
    RETURN 'admin';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.current_period_end > now()
      AND (
        coalesce(p.is_premium, false) = true
        OR lower(coalesce(p.plan, '')) = 'premium'
        OR lower(coalesce(p.subscription_status, '')) IN ('active', 'trialing', 'premium')
      )
  ) INTO v_profile_active;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.current_period_end > now()
      AND (
        lower(coalesce(us.plan, '')) = 'premium'
        OR lower(coalesce(us.status, '')) IN ('active', 'trialing')
      )
  ) INTO v_subscription_active;

  IF v_profile_active OR v_subscription_active THEN
    RETURN 'premium';
  END IF;

  RETURN 'free';
END;
$$;

-- Funkcja porządkowa: możesz ją uruchamiać ręcznie albo z crona raz dziennie.
CREATE OR REPLACE FUNCTION public.expire_finished_premium_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET is_premium = false,
      plan = 'free',
      subscription_status = 'free'
  WHERE coalesce(is_admin, false) = false
    AND current_period_end IS NOT NULL
    AND current_period_end <= now();

  UPDATE public.user_subscriptions
  SET plan = 'free',
      status = 'free',
      updated_at = now()
  WHERE current_period_end IS NOT NULL
    AND current_period_end <= now();
END;
$$;

-- Od razu porządkuj wygasłe stare konta.
SELECT public.expire_finished_premium_accounts();

-- Kontrola wyniku:
SELECT email, username, is_admin, is_premium, plan, subscription_status, current_period_end,
       public.get_user_status(id) AS status_z_bazy
FROM public.profiles
WHERE lower(email) IN ('smilhytv@gmail.com', 'buchajson1988@gmail.com')
   OR lower(username) IN ('smilhytv', 'buchajson1988');
