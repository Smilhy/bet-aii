-- Opcjonalnie uruchom raz w Supabase SQL Editor.
-- Nie jest wymagane dla wersji 1480, bo zapis AI nie używa już on_conflict/upsert.
-- Pomaga tylko przy szybszym sprawdzaniu duplikatów i czytaniu zapisanych typów AI.

create index if not exists tips_ai_external_key_idx
on public.tips (ai_external_key)
where ai_external_key is not null;

create index if not exists tips_ai_event_time_idx
on public.tips (event_time)
where ai_source ilike '%ai%' or source ilike '%ai%';

create index if not exists tips_ai_source_idx
on public.tips (ai_source);

create index if not exists tips_source_idx
on public.tips (source);
