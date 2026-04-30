-- VERSION 162 — ADMIN PAYOUTS UX PRO SUPPORT
-- Safe backend helpers for the upgraded Admin wypłaty panel.

alter table public.payouts add column if not exists ui_label text;
alter table public.payouts add column if not exists ui_color text;
alter table public.payouts add column if not exists ui_priority numeric default 0;
alter table public.payouts add column if not exists amount_display text;
alter table public.payouts add column if not exists stripe_transfer_id text;

update public.payouts
set
  status = lower(coalesce(status, 'pending')),
  amount_display = coalesce(amount::text, '0') || ' zł',
  ui_label = case
    when lower(coalesce(status, 'pending')) = 'pending' then '⏳ Pending'
    when lower(coalesce(status, 'pending')) = 'processing' then '⚙️ Processing'
    when lower(coalesce(status, 'pending')) = 'approved' then '✅ Approved'
    when lower(coalesce(status, 'pending')) = 'paid' then '💸 Paid'
    when lower(coalesce(status, 'pending')) = 'rejected' then '❌ Rejected'
    when lower(coalesce(status, 'pending')) = 'failed' then '⚠️ Failed'
    else '—'
  end,
  ui_color = case
    when lower(coalesce(status, 'pending')) = 'pending' then 'yellow'
    when lower(coalesce(status, 'pending')) = 'processing' then 'blue'
    when lower(coalesce(status, 'pending')) = 'approved' then 'green'
    when lower(coalesce(status, 'pending')) = 'paid' then 'emerald'
    when lower(coalesce(status, 'pending')) = 'rejected' then 'red'
    when lower(coalesce(status, 'pending')) = 'failed' then 'red'
    else 'gray'
  end,
  ui_priority = case
    when lower(coalesce(status, 'pending')) = 'processing' then 100
    when lower(coalesce(status, 'pending')) = 'pending' then 80
    when lower(coalesce(status, 'pending')) = 'approved' then 60
    when lower(coalesce(status, 'pending')) = 'paid' then 40
    when lower(coalesce(status, 'pending')) = 'rejected' then 20
    when lower(coalesce(status, 'pending')) = 'failed' then 10
    else 0
  end;

drop view if exists public.admin_payouts_view;
create view public.admin_payouts_view as
select
  id,
  user_id,
  amount,
  amount_display,
  status,
  ui_label,
  ui_color,
  ui_priority,
  stripe_transfer_id,
  stripe_status,
  created_at
from public.payouts
order by ui_priority desc, created_at desc;

create or replace view public.admin_payouts_stats as
select
  count(*) as total_count,
  count(*) filter (where lower(status) = 'pending') as pending_count,
  count(*) filter (where lower(status) = 'processing') as processing_count,
  count(*) filter (where lower(status) = 'paid') as paid_count,
  count(*) filter (where lower(status) = 'rejected') as rejected_count,
  count(*) filter (where lower(status) = 'failed') as failed_count,
  coalesce(sum(amount) filter (where lower(status) = 'pending'), 0) as pending_amount,
  coalesce(sum(amount) filter (where lower(status) = 'paid'), 0) as paid_amount
from public.payouts;

create index if not exists idx_payouts_status_v162 on public.payouts(status);
create index if not exists idx_payouts_created_at_v162 on public.payouts(created_at desc);
create index if not exists idx_payouts_ui_priority_v162 on public.payouts(ui_priority desc);

notify pgrst, 'reload schema';
