-- Optional but recommended for realtime postgres_changes
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.presence_heartbeats;