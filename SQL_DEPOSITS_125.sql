create extension if not exists pgcrypto;

create table if not exists public.betai_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid null,
  amount_pln numeric(12,3) not null,
  method text not null,
  sender_name text null,
  proof text null,
  tokens_to_grant integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists betai_deposit_requests_created_idx
  on public.betai_deposit_requests(created_at desc);

alter table public.betai_deposit_requests enable row level security;

drop policy if exists "deposit select own or admin" on public.betai_deposit_requests;
create policy "deposit select own or admin"
on public.betai_deposit_requests
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "deposit insert own" on public.betai_deposit_requests;
create policy "deposit insert own"
on public.betai_deposit_requests
for insert
to authenticated
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "deposit update admin" on public.betai_deposit_requests;
create policy "deposit update admin"
on public.betai_deposit_requests
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);