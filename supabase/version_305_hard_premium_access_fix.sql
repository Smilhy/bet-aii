-- WERSJA 305 - TWARDY FIX PREMIUM/ADMIN PO EMAILU + LIMIT FREE 5/DZIEN
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';

UPDATE profiles SET is_admin=FALSE,is_premium=FALSE,plan='free',subscription_status='free';
UPDATE profiles SET is_admin=TRUE,is_premium=TRUE,plan='premium',subscription_status='active' WHERE lower(email)='smilhytv@gmail.com' OR lower(username)='smilhytv';
UPDATE profiles SET is_admin=FALSE,is_premium=TRUE,plan='premium',subscription_status='active' WHERE lower(email)='buchajson1988@gmail.com' OR lower(username)='buchajson1988';

DROP TRIGGER IF EXISTS trigger_tip_limit ON tips;
DROP TRIGGER IF EXISTS trigger_block_premium ON tips;
DROP FUNCTION IF EXISTS enforce_tip_limit();
DROP FUNCTION IF EXISTS block_free_premium_tips();
DROP FUNCTION IF EXISTS can_add_tip(UUID);
DROP FUNCTION IF EXISTS is_betai_premium_user(UUID);

CREATE OR REPLACE FUNCTION is_betai_premium_user(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_profile RECORD; v_auth_email TEXT;
BEGIN
  SELECT lower(email) email, lower(username) username, COALESCE(is_admin,FALSE) is_admin, COALESCE(is_premium,FALSE) is_premium, lower(COALESCE(plan,'free')) plan, lower(COALESCE(subscription_status,'free')) subscription_status
  INTO v_profile FROM profiles WHERE id=p_user_id LIMIT 1;
  SELECT lower(email) INTO v_auth_email FROM auth.users WHERE id=p_user_id LIMIT 1;
  IF v_auth_email IN ('smilhytv@gmail.com','buchajson1988@gmail.com') THEN RETURN TRUE; END IF;
  IF v_profile.email IN ('smilhytv@gmail.com','buchajson1988@gmail.com') OR v_profile.username IN ('smilhytv','buchajson1988') THEN RETURN TRUE; END IF;
  IF COALESCE(v_profile.is_admin,FALSE)=TRUE OR COALESCE(v_profile.is_premium,FALSE)=TRUE OR v_profile.plan IN ('premium','vip','admin') OR v_profile.subscription_status IN ('active','trialing','premium') THEN RETURN TRUE; END IF;
  RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION can_add_tip(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE tips_today INTEGER;
BEGIN
  IF is_betai_premium_user(p_user_id) THEN RETURN TRUE; END IF;
  SELECT COUNT(*) INTO tips_today FROM tips WHERE tips.user_id=p_user_id AND tips.created_at >= date_trunc('day', now());
  RETURN tips_today < 5;
END; $$;

CREATE OR REPLACE FUNCTION enforce_tip_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT can_add_tip(NEW.user_id) THEN RAISE EXCEPTION 'FREE_LIMIT: Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION block_free_premium_tips()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF COALESCE(NEW.is_premium,FALSE)=TRUE OR COALESCE(NEW.access_type,'free')='premium' THEN
    IF NOT is_betai_premium_user(NEW.user_id) THEN RAISE EXCEPTION 'PREMIUM_REQUIRED: Tylko konta Premium mogą dodawać typy premium.'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_tip_limit BEFORE INSERT ON tips FOR EACH ROW EXECUTE FUNCTION enforce_tip_limit();
CREATE TRIGGER trigger_block_premium BEFORE INSERT ON tips FOR EACH ROW EXECUTE FUNCTION block_free_premium_tips();
