-- BETAI_SQL_908_SAFE_AVATARS_EVERYONE_NO_PROFILE_AVATAR_URL.sql
-- Naprawia widoczność avatarów innych użytkowników.
-- Przyczyna: w public.profiles nie masz kolumny profile_avatar_url, więc frontend/SQL muszą używać profiles.avatar_url.
-- Uruchom całość w Supabase SQL Editor.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

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

-- Typy: przepisz avatar dokładnie z profiles.avatar_url.
UPDATE public.tips t
SET
  author_avatar_url = COALESCE(NULLIF(p.avatar_url, ''), t.author_avatar_url),
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), t.avatar_url),
  profile_avatar_url = COALESCE(NULLIF(p.avatar_url, ''), t.profile_avatar_url),
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

-- Live chat: przepisz avatar dokładnie z profiles.avatar_url.
UPDATE public.live_chat_messages m
SET
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), m.avatar_url),
  user_name = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), m.user_name)
FROM public.profiles p
WHERE
  lower(p.email) = lower(coalesce(m.user_email, ''))
  OR lower(p.username) = lower(coalesce(m.user_name, ''))
  OR lower(split_part(p.email, '@', 1)) = lower(coalesce(m.user_name, ''));

-- Trigger: tips zawsze bierze avatar z profiles.avatar_url.
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

-- Trigger: live chat zawsze bierze avatar z profiles.avatar_url.
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

NOTIFY pgrst, 'reload schema';

-- Kontrola: sprawdź, czy smilhytv i buchajson1988 mają inne avatar_url.
SELECT
  username,
  email,
  left(avatar_url, 150) AS profile_avatar_url
FROM public.profiles
WHERE lower(coalesce(username,'')) IN ('smilhytv','buchajson1988')
   OR lower(coalesce(email,'')) IN ('smilhytv@gmail.com','buchajson1988@gmail.com');

-- Kontrola typów.
SELECT
  author_name,
  author_email,
  left(author_avatar_url, 150) AS tip_avatar
FROM public.tips
ORDER BY created_at DESC
LIMIT 20;

-- Kontrola czatu.
SELECT
  user_name,
  user_email,
  left(avatar_url, 150) AS chat_avatar
FROM public.live_chat_messages
ORDER BY created_at DESC
LIMIT 20;