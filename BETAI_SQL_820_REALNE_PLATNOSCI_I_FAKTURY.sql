-- BETAI SQL 820 — realne płatności i faktury
-- Dodaje kolumny potrzebne do prawdziwych linków faktur Stripe.
-- UI wersji 820 nie pokazuje już fejkowych faktur.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_pdf_url text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_url text;

CREATE INDEX IF NOT EXISTS payments_user_id_created_at_idx
ON public.payments(user_id, created_at DESC);

-- Kontrola: zobacz realne dokumenty konta buchajson1988.
SELECT
  p.id,
  p.created_at,
  p.amount,
  p.currency,
  p.status,
  p.provider,
  p.invoice_number,
  p.invoice_pdf_url,
  p.invoice_url
FROM public.payments p
WHERE p.user_id = (
  SELECT id FROM auth.users WHERE lower(email) = 'buchajson1988@gmail.com'
)
ORDER BY p.created_at DESC;
