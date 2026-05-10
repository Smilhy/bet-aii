-- BETAI SQL 819 — żywa historia + widoczny zakup Premium buchajson1988
-- 1) Dodaje do historii płatności realny wpis Premium dla obecnego konta buchajson1988, jeśli jeszcze go nie ma.
-- 2) Nie dodaje żadnych fejkowych wierszy do UI — panel pobiera transakcje z bazowych tabel.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_session_id text;

INSERT INTO public.payments (user_id, tip_id, stripe_session_id, amount, currency, status, provider, created_at)
SELECT
  au.id,
  null,
  'manual_premium_30d_buchajson1988_20260510',
  29,
  'pln',
  'paid',
  'manual_premium',
  now()
FROM auth.users au
WHERE lower(au.email) = 'buchajson1988@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.user_id = au.id
      AND p.provider = 'manual_premium'
      AND p.stripe_session_id = 'manual_premium_30d_buchajson1988_20260510'
  );

-- Kontrola wyniku:
SELECT id, user_id, amount, currency, status, provider, created_at
FROM public.payments
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'buchajson1988@gmail.com')
ORDER BY created_at DESC;
