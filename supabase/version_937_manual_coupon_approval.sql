-- WERSJA 937 — ręczne rozliczanie kuponów z zatwierdzeniem admina
-- Uruchom w Supabase SQL Editor przed testem funkcji.
-- Typer może zgłosić wynik ręcznego typu, ale statystyki dopisują się dopiero po zatwierdzeniu admina.

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
  add column if not exists settlement_source text default 'manual_user';

create index if not exists tips_admin_approval_status_idx
  on public.tips(admin_approval_status);

create index if not exists tips_manual_settlement_status_idx
  on public.tips(manual_settlement_status);

create index if not exists tips_manual_settlement_requested_at_idx
  on public.tips(manual_settlement_requested_at desc);

-- Zalecana logika:
-- status='pending_admin' + admin_approval_status='pending' => czeka na admina i NIE powinno liczyć się do statystyk jako win/loss
-- admin zatwierdza => status='won'/'lost'/'void' + admin_approval_status='approved'
-- admin odrzuca => status='pending' + admin_approval_status='rejected'
