-- BETAI_SQL_907_FIX_CHAT_AVATARS_AND_SMILHYTV_PREMIUM.sql
-- Naprawa:
-- 1) live chat i typy biorą avatar z public.profiles.avatar_url,
-- 2) czyści błędne/stare avatar_url w live_chat_messages i tips,
-- 3) smilhytv zostaje Premium/Admin i może dodawać typy premium.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;

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

ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS profile_avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_email text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_id uuid;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS user_email text;

-- Backfill typów: avatar dokładnie z profilu autora.
UPDATE public.tips t
SET
  author_avatar_url = NULLIF(p.avatar_url, ''),
  avatar_url = NULLIF(p.avatar_url, ''),
  profile_avatar_url = NULLIF(p.avatar_url, ''),
  author_name = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.author_name),
  username = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.username),
  author_email = COALESCE(t.author_email, p.email),
  author_id = COALESCE(t.author_id, p.id),
  user_id = COALESCE(t.user_id, p.id)
FROM public.profiles p
WHERE
  p.id = COALESCE(t.author_id, t.user_id)
  OR lower(p.email) = lower(coalesce(t.author_email, ''))
  OR lower(p.username) = lower(coalesce(t.author_name, t.username, ''))
  OR lower(split_part(p.email, '@', 1)) = lower(coalesce(t.author_name, t.username, ''));

-- Backfill live chat: avatar dokładnie z profilu autora wiadomości.
UPDATE public.live_chat_messages m
SET
  avatar_url = NULLIF(p.avatar_url, ''),
  user_name = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), m.user_name)
FROM public.profiles p
WHERE
  lower(p.email) = lower(coalesce(m.user_email, ''))
  OR lower(p.username) = lower(coalesce(m.user_name, ''))
  OR lower(split_part(p.email, '@', 1)) = lower(coalesce(m.user_name, ''));

-- Trigger tips: przy zapisie zawsze przypisz avatar właściwego profilu.
CREATE OR REPLACE FUNCTION public.betai_sync_tip_author_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_avatar text;
  v_name text;
BEGIN
  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE
    (NEW.author_id IS NOT NULL AND p.id = NEW.author_id)
    OR (NEW.user_id IS NOT NULL AND p.id = NEW.user_id)
    OR (NEW.author_email IS NOT NULL AND lower(p.email) = lower(NEW.author_email))
    OR (NEW.author_name IS NOT NULL AND lower(p.username) = lower(NEW.author_name))
    OR (NEW.username IS NOT NULL AND lower(p.username) = lower(NEW.username))
    OR (NEW.author_name IS NOT NULL AND lower(split_part(p.email, '@', 1)) = lower(NEW.author_name))
    OR (NEW.username IS NOT NULL AND lower(split_part(p.email, '@', 1)) = lower(NEW.username))
  LIMIT 1;

  IF v_profile.id IS NOT NULL THEN
    v_avatar := NULLIF(v_profile.avatar_url, '');
    v_name := COALESCE(NULLIF(v_profile.username, ''), split_part(v_profile.email, '@', 1));

    NEW.author_name := v_name;
    NEW.username := v_name;
    NEW.author_email := COALESCE(NEW.author_email, v_profile.email);
    NEW.author_id := COALESCE(NEW.author_id, v_profile.id);
    NEW.user_id := COALESCE(NEW.user_id, v_profile.id);

    IF v_avatar IS NOT NULL THEN
      NEW.author_avatar_url := v_avatar;
      NEW.avatar_url := v_avatar;
      NEW.profile_avatar_url := v_avatar;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS betai_sync_tip_author_avatar_trigger ON public.tips;
CREATE TRIGGER betai_sync_tip_author_avatar_trigger
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.betai_sync_tip_author_avatar();

-- Trigger live chat: przy zapisie zawsze przypisz avatar właściwego profilu.
CREATE OR REPLACE FUNCTION public.betai_sync_live_chat_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_avatar text;
BEGIN
  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE
    (NEW.user_email IS NOT NULL AND lower(p.email) = lower(NEW.user_email))
    OR (NEW.user_name IS NOT NULL AND lower(p.username) = lower(NEW.user_name))
    OR (NEW.user_name IS NOT NULL AND lower(split_part(p.email, '@', 1)) = lower(NEW.user_name))
  LIMIT 1;

  IF v_profile.id IS NOT NULL THEN
    v_avatar := NULLIF(v_profile.avatar_url, '');
    NEW.user_name := COALESCE(NULLIF(v_profile.username, ''), split_part(v_profile.email, '@', 1));
    IF v_avatar IS NOT NULL THEN
      NEW.avatar_url := v_avatar;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS betai_sync_live_chat_avatar_trigger ON public.live_chat_messages;
CREATE TRIGGER betai_sync_live_chat_avatar_trigger
BEFORE INSERT OR UPDATE ON public.live_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.betai_sync_live_chat_avatar();

-- Premium/Admin check dla smilhytv.
CREATE OR REPLACE FUNCTION public.betai_user_is_premium_safe(
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
  v_result boolean := false;
BEGIN
  IF v_email = 'smilhytv@gmail.com'
     OR split_part(v_email, '@', 1) = 'smilhytv'
     OR v_username = 'smilhytv'
  THEN
    RETURN true;
  END IF;

  SELECT true
  INTO v_result
  FROM public.profiles p
  WHERE
    (
      p_user_id IS NOT NULL AND p.id = p_user_id
    )
    OR (
      v_email <> '' AND lower(coalesce(p.email, '')) = v_email
    )
    OR (
      v_username <> '' AND lower(coalesce(p.username, '')) = v_username
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

CREATE OR REPLACE FUNCTION public.block_free_premium_tips()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_author_id uuid;
  v_author_email text;
  v_author_name text;
  v_is_premium_tip boolean := false;
BEGIN
  v_payload := to_jsonb(NEW);

  v_author_id := COALESCE(
    NULLIF(v_payload->>'user_id', '')::uuid,
    NULLIF(v_payload->>'author_id', '')::uuid
  );

  v_author_email := lower(coalesce(v_payload->>'author_email', v_payload->>'email', ''));
  v_author_name := lower(coalesce(v_payload->>'author_name', v_payload->>'username', ''));

  IF v_author_email = 'smilhytv@gmail.com'
     OR split_part(v_author_email, '@', 1) = 'smilhytv'
     OR v_author_name = 'smilhytv'
     OR public.betai_user_is_premium_safe(v_author_id, v_author_email, v_author_name)
  THEN
    NEW.is_premium := true;
    NEW.access_type := 'premium';
    RETURN NEW;
  END IF;

  v_is_premium_tip :=
    coalesce((v_payload->>'is_premium')::boolean, false) = true
    OR lower(coalesce(v_payload->>'access_type', 'free')) IN ('premium', 'paid')
    OR coalesce(NULLIF(v_payload->>'price', '')::numeric, 0) > 0
    OR coalesce(NULLIF(v_payload->>'single_price', '')::numeric, 0) > 0
    OR coalesce(NULLIF(v_payload->>'tip_price', '')::numeric, 0) > 0;

  IF NOT v_is_premium_tip THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PREMIUM_REQUIRED: Tylko konta Premium mogą dodawać typy premium.';
END;
$$;

DROP TRIGGER IF EXISTS trigger_block_premium ON public.tips;
DROP TRIGGER IF EXISTS block_free_premium_tips_trigger ON public.tips;

CREATE TRIGGER trigger_block_premium
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.block_free_premium_tips();

NOTIFY pgrst, 'reload schema';

SELECT
  username,
  email,
  left(avatar_url, 120) AS profile_avatar_url,
  is_admin,
  is_premium,
  role,
  plan,
  public.betai_user_is_premium_safe(id, email, username) AS premium_check
FROM public.profiles
WHERE lower(coalesce(email,'')) IN ('smilhytv@gmail.com','buchajson1988@gmail.com')
   OR lower(coalesce(username,'')) IN ('smilhytv','buchajson1988');

SELECT
  user_name,
  user_email,
  left(avatar_url, 120) AS chat_avatar_url
FROM public.live_chat_messages
ORDER BY created_at DESC
LIMIT 20;