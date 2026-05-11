-- BETAI_SQL_912_CANONICAL_AVATARS_FIX.sql
-- Naprawia sytuację, gdzie smilhytv w typach/czacie/rankingu dostaje avatar buchajson1988.
-- Przyczyna: stare rekordy tips/live_chat_messages mają błędnie zapisany avatar_url.
-- Rozwiązanie:
-- 1) publiczna tabela override avatarów,
-- 2) próba pobrania prawdziwego avatara z auth.users metadata,
-- 3) funkcja RPC zwraca avatar z override/auth/profiles,
-- 4) tips/live_chat_messages synchronizowane z kanonicznym avatarem.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS public.betai_public_avatar_overrides (
  email text PRIMARY KEY,
  username text,
  avatar_url text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Spróbuj pobrać prawdziwy avatar z auth.users dla każdego usera.
-- To zwykle jest ten avatar, który widzisz poprawnie w lewym panelu po zalogowaniu.
INSERT INTO public.betai_public_avatar_overrides (email, username, avatar_url, updated_at)
SELECT
  lower(au.email) AS email,
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'username', ''),
    NULLIF(au.raw_user_meta_data->>'name', ''),
    split_part(lower(au.email), '@', 1)
  ) AS username,
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(au.raw_user_meta_data->>'picture', ''),
    NULLIF(au.raw_user_meta_data->>'photo_url', ''),
    NULLIF(au.raw_user_meta_data->>'image_url', '')
  ) AS avatar_url,
  now()
FROM auth.users au
WHERE COALESCE(
    NULLIF(au.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(au.raw_user_meta_data->>'picture', ''),
    NULLIF(au.raw_user_meta_data->>'photo_url', ''),
    NULLIF(au.raw_user_meta_data->>'image_url', '')
  ) IS NOT NULL
ON CONFLICT (email) DO UPDATE
SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = now();

-- Jeśli profil ma avatar, a override nie ma, dodaj go jako fallback.
INSERT INTO public.betai_public_avatar_overrides (email, username, avatar_url, updated_at)
SELECT
  lower(p.email),
  COALESCE(NULLIF(p.username, ''), split_part(lower(p.email), '@', 1)),
  p.avatar_url,
  now()
FROM public.profiles p
WHERE NULLIF(p.avatar_url, '') IS NOT NULL
  AND NULLIF(p.email, '') IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- Zaktualizuj profiles z override.
UPDATE public.profiles p
SET
  avatar_url = o.avatar_url,
  username = COALESCE(NULLIF(p.username, ''), o.username)
FROM public.betai_public_avatar_overrides o
WHERE lower(p.email) = lower(o.email)
  AND NULLIF(o.avatar_url, '') IS NOT NULL;

-- Publiczny RPC z kanonicznym avatarem.
CREATE OR REPLACE FUNCTION public.betai_public_profiles_for_ui()
RETURNS TABLE (
  id uuid,
  email text,
  username text,
  avatar_url text,
  imported_yield numeric,
  imported_total_tips numeric,
  imported_won_tips numeric,
  imported_lost_tips numeric,
  imported_pending_tips numeric,
  imported_total_staked numeric,
  imported_profit numeric,
  imported_avg_odds numeric,
  imported_highest_odds numeric,
  imported_tips_currency text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), 'Użytkownik') AS username,
    COALESCE(NULLIF(o.avatar_url, ''), NULLIF(p.avatar_url, '')) AS avatar_url,
    COALESCE(p.imported_yield, 0) AS imported_yield,
    COALESCE(p.imported_total_tips, 0) AS imported_total_tips,
    COALESCE(p.imported_won_tips, 0) AS imported_won_tips,
    COALESCE(p.imported_lost_tips, 0) AS imported_lost_tips,
    COALESCE(p.imported_pending_tips, 0) AS imported_pending_tips,
    COALESCE(p.imported_total_staked, 0) AS imported_total_staked,
    COALESCE(p.imported_profit, 0) AS imported_profit,
    COALESCE(p.imported_avg_odds, 0) AS imported_avg_odds,
    COALESCE(p.imported_highest_odds, 0) AS imported_highest_odds,
    COALESCE(p.imported_tips_currency, 'zł') AS imported_tips_currency
  FROM public.profiles p
  LEFT JOIN public.betai_public_avatar_overrides o ON lower(o.email) = lower(p.email)
  WHERE COALESCE(NULLIF(p.username, ''), NULLIF(p.email, '')) IS NOT NULL
  ORDER BY COALESCE(p.imported_profit, 0) DESC, COALESCE(p.imported_total_tips, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.betai_public_profiles_for_ui() TO anon;
GRANT EXECUTE ON FUNCTION public.betai_public_profiles_for_ui() TO authenticated;

CREATE OR REPLACE VIEW public.betai_public_profiles_for_ui_view AS
SELECT * FROM public.betai_public_profiles_for_ui();

GRANT SELECT ON public.betai_public_profiles_for_ui_view TO anon;
GRANT SELECT ON public.betai_public_profiles_for_ui_view TO authenticated;

ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS profile_avatar_url text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS author_email text;

ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS user_email text;

-- Synchronizacja typów z kanonicznym avatarem po email/username.
WITH canon AS (
  SELECT * FROM public.betai_public_profiles_for_ui()
)
UPDATE public.tips t
SET
  author_avatar_url = c.avatar_url,
  avatar_url = c.avatar_url,
  profile_avatar_url = c.avatar_url,
  author_name = c.username,
  username = c.username,
  author_email = COALESCE(t.author_email, c.email)
FROM canon c
WHERE NULLIF(c.avatar_url, '') IS NOT NULL
  AND (
    lower(coalesce(t.author_email, t.email, '')) = lower(c.email)
    OR lower(coalesce(t.author_name, t.username, '')) = lower(c.username)
    OR lower(coalesce(t.author_name, t.username, '')) = lower(split_part(c.email, '@', 1))
  );

-- Synchronizacja czatu z kanonicznym avatarem po email/username.
WITH canon AS (
  SELECT * FROM public.betai_public_profiles_for_ui()
)
UPDATE public.live_chat_messages m
SET
  avatar_url = c.avatar_url,
  user_name = c.username,
  user_email = COALESCE(m.user_email, c.email)
FROM canon c
WHERE NULLIF(c.avatar_url, '') IS NOT NULL
  AND (
    lower(coalesce(m.user_email, '')) = lower(c.email)
    OR lower(coalesce(m.user_name, '')) = lower(c.username)
    OR lower(coalesce(m.user_name, '')) = lower(split_part(c.email, '@', 1))
  );

NOTIFY pgrst, 'reload schema';

-- Kontrola: smilhytv i buchajson1988 NIE mogą mieć tego samego avatar_url.
SELECT
  username,
  email,
  left(avatar_url, 220) AS avatar_url
FROM public.betai_public_profiles_for_ui()
WHERE lower(coalesce(username,'')) IN ('smilhytv','buchajson1988')
   OR lower(coalesce(email,'')) IN ('smilhytv@gmail.com','buchajson1988@gmail.com');

SELECT
  author_name,
  author_email,
  left(author_avatar_url, 220) AS author_avatar_url
FROM public.tips
WHERE lower(coalesce(author_name, username, '')) IN ('smilhytv','buchajson1988')
   OR lower(coalesce(author_email, email, '')) IN ('smilhytv@gmail.com','buchajson1988@gmail.com')
ORDER BY created_at DESC
LIMIT 30;

SELECT
  user_name,
  user_email,
  left(avatar_url, 220) AS avatar_url
FROM public.live_chat_messages
WHERE lower(coalesce(user_name, '')) IN ('smilhytv','buchajson1988')
   OR lower(coalesce(user_email, '')) IN ('smilhytv@gmail.com','buchajson1988@gmail.com')
ORDER BY created_at DESC
LIMIT 30;