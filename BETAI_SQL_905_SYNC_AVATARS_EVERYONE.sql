-- BETAI_SQL_905_SYNC_AVATARS_EVERYONE.sql
-- Każdy ma widzieć avatar każdego: typy + live chat.
-- Uruchom w Supabase SQL Editor.

ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS profile_avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_email text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_id uuid;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS user_id uuid;

-- 1) Backfill avatarów i nicków w starych typach z profiles.
UPDATE public.tips t
SET
  author_avatar_url = COALESCE(NULLIF(p.avatar_url, ''), NULLIF(p.profile_avatar_url, ''), t.author_avatar_url, t.avatar_url, t.profile_avatar_url),
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), NULLIF(p.profile_avatar_url, ''), t.avatar_url, t.author_avatar_url, t.profile_avatar_url),
  profile_avatar_url = COALESCE(NULLIF(p.profile_avatar_url, ''), NULLIF(p.avatar_url, ''), t.profile_avatar_url, t.author_avatar_url, t.avatar_url),
  author_name = CASE
    WHEN lower(coalesce(t.author_name, '')) IN ('', 'user', 'użytkownik', 'uzytkownik')
      THEN COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.author_name)
    ELSE t.author_name
  END,
  username = CASE
    WHEN lower(coalesce(t.username, '')) IN ('', 'user', 'użytkownik', 'uzytkownik')
      THEN COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.username)
    ELSE t.username
  END,
  author_email = COALESCE(t.author_email, p.email),
  author_id = COALESCE(t.author_id, p.id),
  user_id = COALESCE(t.user_id, p.id)
FROM public.profiles p
WHERE
  p.id = COALESCE(t.author_id, t.user_id)
  OR lower(p.email) = lower(coalesce(t.author_email, ''))
  OR lower(p.username) = lower(coalesce(t.author_name, t.username, ''));

-- 2) Live chat: kolumny i backfill.
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS user_email text;

UPDATE public.live_chat_messages m
SET
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), NULLIF(p.profile_avatar_url, ''), m.avatar_url),
  user_name = CASE
    WHEN lower(coalesce(m.user_name, '')) IN ('', 'user', 'użytkownik', 'uzytkownik')
      THEN COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), m.user_name)
    ELSE m.user_name
  END
FROM public.profiles p
WHERE
  lower(p.email) = lower(coalesce(m.user_email, ''))
  OR lower(p.username) = lower(coalesce(m.user_name, ''))
  OR lower(split_part(p.email, '@', 1)) = lower(coalesce(m.user_name, ''));

-- 3) Trigger dla tips: przy insert/update dopisz avatar z profiles.
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
  LIMIT 1;

  IF v_profile.id IS NOT NULL THEN
    v_avatar := COALESCE(NULLIF(v_profile.avatar_url, ''), NULLIF(v_profile.profile_avatar_url, ''));
    v_name := COALESCE(NULLIF(v_profile.username, ''), split_part(v_profile.email, '@', 1));

    IF v_avatar IS NOT NULL THEN
      NEW.author_avatar_url := v_avatar;
      NEW.avatar_url := COALESCE(NEW.avatar_url, v_avatar);
      NEW.profile_avatar_url := COALESCE(NEW.profile_avatar_url, v_avatar);
    END IF;

    IF lower(coalesce(NEW.author_name, '')) IN ('', 'user', 'użytkownik', 'uzytkownik') THEN
      NEW.author_name := v_name;
    END IF;
    IF lower(coalesce(NEW.username, '')) IN ('', 'user', 'użytkownik', 'uzytkownik') THEN
      NEW.username := v_name;
    END IF;

    NEW.author_email := COALESCE(NEW.author_email, v_profile.email);
    NEW.author_id := COALESCE(NEW.author_id, v_profile.id);
    NEW.user_id := COALESCE(NEW.user_id, v_profile.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS betai_sync_tip_author_avatar_trigger ON public.tips;

CREATE TRIGGER betai_sync_tip_author_avatar_trigger
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.betai_sync_tip_author_avatar();

-- 4) Trigger live chat: przy nowych wiadomościach zapisuje avatar.
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
    v_avatar := COALESCE(NULLIF(v_profile.avatar_url, ''), NULLIF(v_profile.profile_avatar_url, ''));
    IF v_avatar IS NOT NULL THEN
      NEW.avatar_url := v_avatar;
    END IF;

    IF lower(coalesce(NEW.user_name, '')) IN ('', 'user', 'użytkownik', 'uzytkownik') THEN
      NEW.user_name := COALESCE(NULLIF(v_profile.username, ''), split_part(v_profile.email, '@', 1));
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

NOTIFY pgrst, 'reload schema';

-- Kontrola
SELECT
  t.id,
  t.author_name,
  t.author_email,
  left(t.author_avatar_url, 80) AS author_avatar_url
FROM public.tips t
ORDER BY t.created_at DESC
LIMIT 20;

SELECT
  m.id,
  m.user_name,
  m.user_email,
  left(m.avatar_url, 80) AS avatar_url
FROM public.live_chat_messages m
ORDER BY m.created_at DESC
LIMIT 20;