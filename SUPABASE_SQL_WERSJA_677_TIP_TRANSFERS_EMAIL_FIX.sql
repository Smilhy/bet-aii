-- BET+AI WERSJA 677
-- WAŻNE: wklej do Supabase SQL Editor, jeżeli chcesz żeby TIP popup działał każdy -> każdy,
-- także dla kont, gdzie receiver_id w tabeli tip_transfers wychodzi pusty.

alter table public.tip_transfers
  add column if not exists sender_email text,
  add column if not exists receiver_email text;

alter table public.tip_transfers enable row level security;

-- Dodatkowe polityki po emailu. Nie usuwają Twoich starych polityk po id.
drop policy if exists "tip transfers read by id or email v677" on public.tip_transfers;
create policy "tip transfers read by id or email v677"
on public.tip_transfers
for select
using (
  auth.uid() = sender_id
  or auth.uid() = receiver_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(coalesce(sender_email, ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(coalesce(receiver_email, ''))
);

drop policy if exists "tip transfers insert by id or email v677" on public.tip_transfers;
create policy "tip transfers insert by id or email v677"
on public.tip_transfers
for insert
with check (
  auth.uid() = sender_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(coalesce(sender_email, ''))
);

-- W panelu Supabase upewnij się jeszcze:
-- Database -> Replication -> tabela tip_transfers jest włączona do realtime.
