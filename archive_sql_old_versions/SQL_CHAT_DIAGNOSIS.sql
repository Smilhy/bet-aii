-- Diagnostic checks for chat send
select 'profiles_count' as test, count(*) from public.profiles;
select 'messages_count' as test, count(*) from public.direct_messages;
select id, email, created_at from public.profiles order by created_at desc limit 20;
select id, sender_id, receiver_id, message_text, created_at from public.direct_messages order by created_at desc limit 20;

-- If insert still fails, recreate the INSERT policy:
drop policy if exists "dm_insert_own" on public.direct_messages;
create policy "dm_insert_own"
on public.direct_messages
for insert
to authenticated
with check (auth.uid() = sender_id);

-- And make sure RLS is enabled:
alter table public.direct_messages enable row level security;