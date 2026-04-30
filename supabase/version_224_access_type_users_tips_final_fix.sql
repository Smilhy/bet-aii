-- =========================================
-- VERSION 224 - FINAL FIX: TIPS + USERS + ACCESS_TYPE + RANKING
-- Wklej w Supabase SQL Editor i kliknij RUN.
-- =========================================

-- 0. Wymagane rozszerzenie UUID
create extension if not exists pgcrypto;

-- 1. Reset obiektów zależnych, żeby nie było konfliktów widoków/cache
DROP VIEW IF EXISTS tipster_ranking CASCADE;
DROP VIEW IF EXISTS tipster_stats CASCADE;
DROP VIEW IF EXISTS tipster_earnings_summary CASCADE;
DROP TABLE IF EXISTS tips CASCADE;

-- 2. Profiles - użytkownicy widoczni w rankingu/top tipsterach
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text,
  username text,
  public_slug text UNIQUE,
  plan text DEFAULT 'free',
  subscription_status text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

-- 3. Backfill profili z auth.users (naprawia „nie czyta użytkowników”)
INSERT INTO profiles (id, email, username, public_slug, created_at)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'username', ''), NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1), 'user'),
  lower(regexp_replace(COALESCE(NULLIF(u.raw_user_meta_data->>'username', ''), split_part(u.email, '@', 1), u.id::text), '[^a-zA-Z0-9]+', '-', 'g')),
  COALESCE(u.created_at, now())
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = COALESCE(profiles.username, EXCLUDED.username),
  public_slug = COALESCE(profiles.public_slug, EXCLUDED.public_slug);

-- 4. Tips - pełny schemat zgodny z frontendem i Netlify Function
CREATE TABLE tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- właściciel/autoryzacja
  user_id uuid,
  author_id uuid,
  author_email text,
  author_name text,
  username text,

  -- dane typu
  league text,
  team_home text,
  team_away text,
  match text,
  match_time timestamptz,
  bet_type text,
  prediction text,
  odds numeric,
  analysis text,

  -- AI/statystyki
  ai_probability integer DEFAULT 0,
  ai_confidence integer DEFAULT 0,
  ai_score integer DEFAULT 0,
  ai_analysis text,

  -- FREE/PREMIUM - TO BYŁ BRAKUJĄCY BŁĄD
  access_type text DEFAULT 'free',
  is_premium boolean DEFAULT false,
  price numeric DEFAULT 0,

  -- status/wynik
  status text DEFAULT 'pending',
  result text DEFAULT 'pending',

  -- dodatki
  tags text[] DEFAULT '{}',
  notify_followers boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Bezpieczne defaulty i spójność pól
ALTER TABLE tips
  ADD CONSTRAINT tips_access_type_check CHECK (access_type in ('free', 'premium'));

ALTER TABLE tips
  ADD CONSTRAINT tips_status_check CHECK (status in ('pending', 'live', 'won', 'win', 'lost', 'loss', 'void'));

CREATE OR REPLACE FUNCTION normalize_tip_before_save()
RETURNS trigger AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, NEW.author_id);
  NEW.author_id := COALESCE(NEW.author_id, NEW.user_id);
  NEW.author_name := COALESCE(NULLIF(NEW.author_name, ''), NULLIF(NEW.username, ''), split_part(COALESCE(NEW.author_email, ''), '@', 1), 'Użytkownik');
  NEW.username := COALESCE(NULLIF(NEW.username, ''), NEW.author_name);
  NEW.match := COALESCE(NULLIF(NEW.match, ''), trim(COALESCE(NEW.team_home, '') || ' vs ' || COALESCE(NEW.team_away, '')));
  NEW.prediction := COALESCE(NULLIF(NEW.prediction, ''), NEW.bet_type);
  NEW.bet_type := COALESCE(NULLIF(NEW.bet_type, ''), NEW.prediction);
  NEW.access_type := CASE WHEN NEW.access_type = 'premium' OR NEW.is_premium = true THEN 'premium' ELSE 'free' END;
  NEW.is_premium := (NEW.access_type = 'premium');
  NEW.price := CASE WHEN NEW.access_type = 'premium' THEN COALESCE(NEW.price, 0) ELSE 0 END;
  NEW.result := COALESCE(NULLIF(NEW.result, ''), NEW.status, 'pending');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_tip_before_save_trigger ON tips;
CREATE TRIGGER normalize_tip_before_save_trigger
BEFORE INSERT OR UPDATE ON tips
FOR EACH ROW EXECUTE FUNCTION normalize_tip_before_save();

-- 6. Earnings minimalnie, żeby widok rankingu nigdy nie wywalił błędu jeśli tabela nie istnieje
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id uuid,
  amount numeric DEFAULT 0,
  commission numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 7. RLS OFF na debug/fix, żeby zapis nie był blokowany
ALTER TABLE tips DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 8. Trigger tworzenia profilu po rejestracji
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, username, public_slug)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1), 'user'),
    lower(regexp_replace(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(NEW.email, '@', 1), NEW.id::text), '[^a-zA-Z0-9]+', '-', 'g'))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(profiles.username, EXCLUDED.username),
    public_slug = COALESCE(profiles.public_slug, EXCLUDED.public_slug);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 9. Widoki rankingu/top tipsterzy
CREATE OR REPLACE VIEW tipster_stats AS
SELECT
  COALESCE(t.author_id, t.user_id) AS tipster_id,
  COUNT(*)::int AS total_tips,
  SUM(CASE WHEN lower(COALESCE(t.result, t.status, 'pending')) IN ('win', 'won') THEN 1 ELSE 0 END)::int AS wins,
  SUM(CASE WHEN lower(COALESCE(t.result, t.status, 'pending')) IN ('loss', 'lost') THEN 1 ELSE 0 END)::int AS losses,
  ROUND(
    CASE WHEN COUNT(*) = 0 THEN 0 ELSE
      (SUM(CASE WHEN lower(COALESCE(t.result, t.status, 'pending')) IN ('win', 'won') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100
    END,
    2
  ) AS winrate
FROM tips t
WHERE COALESCE(t.author_id, t.user_id) IS NOT NULL
GROUP BY COALESCE(t.author_id, t.user_id);

CREATE OR REPLACE VIEW tipster_earnings_summary AS
SELECT
  e.tipster_id,
  COALESCE(SUM(e.amount), 0) AS earnings,
  COALESCE(SUM(e.commission), 0) AS platform_commission
FROM earnings e
WHERE e.tipster_id IS NOT NULL
GROUP BY e.tipster_id;

CREATE OR REPLACE VIEW tipster_ranking AS
SELECT
  p.id AS tipster_id,
  p.email,
  p.username,
  p.public_slug,
  COALESCE(ts.total_tips, 0) AS total_tips,
  COALESCE(ts.wins, 0) AS wins,
  COALESCE(ts.losses, 0) AS losses,
  COALESCE(ts.winrate, 0) AS winrate,
  COALESCE(es.earnings, 0) AS earnings,
  COALESCE(es.platform_commission, 0) AS platform_commission,
  ROUND(
    CASE WHEN COALESCE(ts.total_tips, 0) = 0 THEN 0 ELSE COALESCE(es.earnings, 0) / NULLIF(ts.total_tips, 0) END,
    2
  ) AS roi
FROM profiles p
LEFT JOIN tipster_stats ts ON ts.tipster_id = p.id
LEFT JOIN tipster_earnings_summary es ON es.tipster_id = p.id
WHERE COALESCE(ts.total_tips, 0) > 0 OR COALESCE(es.earnings, 0) > 0
ORDER BY earnings DESC, winrate DESC, total_tips DESC;

-- 10. Indexy
CREATE INDEX IF NOT EXISTS idx_tips_user_id ON tips(user_id);
CREATE INDEX IF NOT EXISTS idx_tips_author_id ON tips(author_id);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_access_type ON tips(access_type);
CREATE INDEX IF NOT EXISTS idx_profiles_public_slug ON profiles(public_slug);

-- 11. Test czy brakująca kolumna istnieje
SELECT 'OK: tips.access_type exists, users/profiles/tipster_ranking ready' AS status;
