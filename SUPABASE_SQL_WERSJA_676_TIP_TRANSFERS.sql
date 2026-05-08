-- BET+AI WERSJA 676
-- WYMAGANE TYLKO JEŚLI NIE DODAŁEŚ JESZCZE TABELI tip_transfers.
-- Jeśli już wykonałeś ten SQL w Supabase, nie musisz robić tego drugi raz.

create table if not exists tip_transfers (
  id bigint generated always as identity primary key,
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  sender_username text,
  receiver_username text,
  amount integer default 1,
  created_at timestamp with time zone default now()
);

alter table tip_transfers enable row level security;

drop policy if exists "users can read own tip transfers" on tip_transfers;
create policy "users can read own tip transfers"
on tip_transfers
for select
using (
  auth.uid() = sender_id
  OR
  auth.uid() = receiver_id
);

drop policy if exists "users can send tip transfers" on tip_transfers;
create policy "users can send tip transfers"
on tip_transfers
for insert
with check (
  auth.uid() = sender_id
);

-- WAŻNE: Supabase Dashboard -> Database -> Replication -> dodaj tabelę tip_transfers do Realtime.
