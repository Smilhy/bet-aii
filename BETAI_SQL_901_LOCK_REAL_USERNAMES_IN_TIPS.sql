-- BETAI_SQL_901_LOCK_REAL_USERNAMES_IN_TIPS.sql
-- Naprawia stare typy z author_name/username='user' oraz blokuje ponowne zapisywanie nicku jako user.
-- Uruchom w Supabase SQL Editor.

ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_email text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_id uuid;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS user_id uuid;

-- 1) Jednorazowa naprawa istniejących typów po id profilu.
UPDATE public.tips t
SET
  author_name = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.author_name),
  username = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.username),
  author_email = COALESCE(t.author_email, p.email)
FROM public.profiles p
WHERE
  (t.author_id = p.id OR t.user_id = p.id)
  AND lower(coalesce(t.author_name, t.username, '')) IN ('user', 'użytkownik', 'uzytkownik', '');

-- 2) Jednorazowa naprawa istniejących typów po emailu.
UPDATE public.tips t
SET
  author_name = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.author_name),
  username = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), t.username),
  author_id = COALESCE(t.author_id, p.id),
  user_id = COALESCE(t.user_id, p.id)
FROM public.profiles p
WHERE
  lower(coalesce(t.author_email, '')) = lower(coalesce(p.email, ''))
  AND lower(coalesce(t.author_name, t.username, '')) IN ('user', 'użytkownik', 'uzytkownik', '');

-- 3) Funkcja przed INSERT/UPDATE: nigdy nie zapisuj generic "user", jeśli istnieje profil.
CREATE OR REPLACE FUNCTION public.betai_lock_real_tip_author_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_clean_name text;
BEGIN
  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE
    (NEW.author_id IS NOT NULL AND p.id = NEW.author_id)
    OR (NEW.user_id IS NOT NULL AND p.id = NEW.user_id)
    OR (NEW.author_email IS NOT NULL AND lower(p.email) = lower(NEW.author_email))
  LIMIT 1;

  IF v_profile.id IS NOT NULL THEN
    v_clean_name := COALESCE(NULLIF(v_profile.username, ''), split_part(v_profile.email, '@', 1));

    IF lower(coalesce(NEW.author_name, '')) IN ('', 'user', 'użytkownik', 'uzytkownik') THEN
      NEW.author_name := v_clean_name;
    END IF;

    IF lower(coalesce(NEW.username, '')) IN ('', 'user', 'użytkownik', 'uzytkownik') THEN
      NEW.username := v_clean_name;
    END IF;

    NEW.author_email := COALESCE(NEW.author_email, v_profile.email);
    NEW.author_id := COALESCE(NEW.author_id, v_profile.id);
    NEW.user_id := COALESCE(NEW.user_id, v_profile.id);
  ELSE
    IF lower(coalesce(NEW.author_name, '')) IN ('', 'user', 'użytkownik', 'uzytkownik')
       AND NEW.author_email IS NOT NULL THEN
      NEW.author_name := split_part(NEW.author_email, '@', 1);
    END IF;

    IF lower(coalesce(NEW.username, '')) IN ('', 'user', 'użytkownik', 'uzytkownik')
       AND NEW.author_email IS NOT NULL THEN
      NEW.username := split_part(NEW.author_email, '@', 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS betai_lock_real_tip_author_name_trigger ON public.tips;

CREATE TRIGGER betai_lock_real_tip_author_name_trigger
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW
EXECUTE FUNCTION public.betai_lock_real_tip_author_name();

NOTIFY pgrst, 'reload schema';

-- Kontrola: po tym SELECT nie powinno być author_name='user' tam, gdzie profil ma normalny username.
SELECT
  t.id,
  t.author_name,
  t.username,
  t.author_email,
  p.username AS profile_username
FROM public.tips t
LEFT JOIN public.profiles p
  ON p.id = COALESCE(t.author_id, t.user_id)
  OR lower(p.email) = lower(coalesce(t.author_email, ''))
WHERE lower(coalesce(t.author_name, t.username, '')) IN ('user', 'użytkownik', 'uzytkownik')
ORDER BY t.created_at DESC
LIMIT 20;