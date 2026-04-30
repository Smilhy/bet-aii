create extension if not exists pgcrypto;

create table if not exists public.betai_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  target_email text null,
  details text null,
  created_at timestamptz not null default now()
);

create index if not exists betai_admin_audit_logs_created_idx
  on public.betai_admin_audit_logs(created_at desc);

alter table public.betai_admin_audit_logs enable row level security;

drop policy if exists "admin audit select admin only" on public.betai_admin_audit_logs;
create policy "admin audit select admin only"
on public.betai_admin_audit_logs
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "admin audit insert admin only" on public.betai_admin_audit_logs;
create policy "admin audit insert admin only"
on public.betai_admin_audit_logs
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);