-- WERSJA 945 — zakładka Wyniki: ręczne rozliczenia + zatwierdzanie admina
-- Uruchom w Supabase SQL Editor.
-- Wymagane do zapisu zgłoszeń wyniku i zatwierdzania przez admina.

alter table public.tips
  add column if not exists manual_settlement_status text default 'none',
  add column if not exists manual_settlement_result text,
  add column if not exists manual_settlement_requested_at timestamptz,
  add column if not exists manual_settlement_requested_by uuid,
  add column if not exists admin_approval_status text default 'none',
  add column if not exists admin_approved_result text,
  add column if not exists admin_approved_at timestamptz,
  add column if not exists admin_approved_by uuid,
  add column if not exists admin_rejected_at timestamptz,
  add column if not exists admin_rejection_reason text,
  add column if not exists settlement_source text default 'manual_or_auto';

create index if not exists tips_manual_settlement_status_idx on public.tips(manual_settlement_status);
create index if not exists tips_admin_approval_status_idx on public.tips(admin_approval_status);
create index if not exists tips_manual_settlement_requested_at_idx on public.tips(manual_settlement_requested_at desc);

-- Logika:
-- status='pending' + admin_approval_status='pending' => użytkownik zgłosił wynik, czeka na admina, NIE liczy się jeszcze do statystyk
-- admin zatwierdza => status='won'/'lost'/'void', manual_settlement_status='approved', admin_approval_status='approved'
-- admin odrzuca => status='pending', manual_settlement_status='rejected', admin_approval_status='rejected'
-- automatyczne rozliczenie w przyszłości powinno ustawiać settlement_source='auto_result_api' oraz status='won'/'lost'/'void'


-- WERSJA 947 — poprawka:
-- Nie ustawiamy status='pending_admin', bo w wielu bazach istnieje constraint tips_status_check_v745b.
-- Oczekiwanie na admina jest oznaczone przez:
-- status='pending'
-- manual_settlement_status='pending_admin'
-- admin_approval_status='pending'
