-- BETAI_SQL_911_PUBLIC_AVATARS_RLS_FIX.sql
-- Naprawia problem:
-- smilhytv widzi swoje avatary, ale buchajson1988 nie widzi avatarów smilhytv,
-- bo RLS na profiles pokazuje tylko własny profil.
--
-- Rozwiązanie:
-- publiczna funkcja SECURITY DEFINER zwraca tylko bezpieczne dane publiczne:
-- id, email, username, avatar_url + statystyki importowane.
-- Frontend 911 używa tej funkcji do typów, czatu i rankingu.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_yield numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_total_tips numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_won_tips numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_lost_tips numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_pending_tips numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_total_staked numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_profit numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_avg_odds numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_highest_odds numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imported_tips_currency text DEFAULT 'zł';

-- Publiczny widok danych do UI.
CREATE OR REPLACE VIEW public.betai_public_profiles_for_ui_view AS
SELECT
  p.id,
  p.email,
  COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), 'Użytkownik') AS username,
  p.avatar_url,
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
WHERE COALESCE(NULLIF(p.username, ''), NULLIF(p.email, '')) IS NOT NULL;

-- RPC o tej samej nazwie, której używa frontend.
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
    p.avatar_url,
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
  WHERE COALESCE(NULLIF(p.username, ''), NULLIF(p.email, '')) IS NOT NULL
  ORDER BY COALESCE(p.imported_profit, 0) DESC, COALESCE(p.imported_total_tips, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.betai_public_profiles_for_ui() TO anon;
GRANT EXECUTE ON FUNCTION public.betai_public_profiles_for_ui() TO authenticated;
GRANT SELECT ON public.betai_public_profiles_for_ui_view TO anon;
GRANT SELECT ON public.betai_public_profiles_for_ui_view TO authenticated;

-- Upewnij się, że tips/chat mają zapisany avatar autora, żeby nawet bez RPC stare karty działały.
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

UPDATE public.live_chat_messages m
SET
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), m.avatar_url),
  user_name = COALESCE(NULLIF(p.username, ''), split_part(p.email, '@', 1), m.user_name)
FROM public.profiles p
WHERE
  lower(p.email) = lower(coalesce(m.user_email, ''))
  OR lower(p.username) = lower(coalesce(m.user_name, ''))
  OR lower(split_part(p.email, '@', 1)) = lower(coalesce(m.user_name, ''));

NOTIFY pgrst, 'reload schema';

-- Kontrola: te dwa konta muszą mieć różne avatar_url.
SELECT
  username,
  email,
  left(avatar_url, 160) AS avatar_url
FROM public.betai_public_profiles_for_ui()
WHERE lower(coalesce(username,'')) IN ('smilhytv','buchajson1988')
   OR lower(coalesce(email,'')) IN ('smilhytv@gmail.com','buchajson1988@gmail.com');

-- Kontrola ostatnich typów: smilhytv ma mieć author_avatar_url.
SELECT
  author_name,
  author_email,
  left(author_avatar_url, 160) AS author_avatar_url
FROM public.tips
ORDER BY created_at DESC
LIMIT 20;

-- Kontrola czatu.
SELECT
  user_name,
  user_email,
  left(avatar_url, 160) AS avatar_url
FROM public.live_chat_messages
ORDER BY created_at DESC
LIMIT 20;