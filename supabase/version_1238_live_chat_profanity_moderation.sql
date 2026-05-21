-- WERSJA 1238 — moderacja live chatu: wykropkowanie przekleństw, ostrzeżenia i blokady
-- Uruchom ten plik w Supabase SQL Editor.
-- Efekt:
-- 1) Przekleństwa w live_chat_messages są automatycznie wykropkowane po stronie bazy.
-- 2) Użytkownik dostaje powiadomienie BetAI z ostrzeżeniem.
-- 3) Po 3 ostrzeżeniach dostaje blokadę czatu na 24h.
-- 4) Po kolejnym przekleństwie po odblokowaniu dostaje blokadę czatu na 7 dni.

create extension if not exists pgcrypto;

create table if not exists public.betai_system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null default 'Wiadomość BetAI',
  body text,
  message text,
  reward_tokens integer not null default 0,
  sent_by text not null default 'betai',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.live_chat_moderation (
  email text primary key,
  warning_count integer not null default 0,
  penalty_stage integer not null default 0,
  block_until timestamptz,
  last_warning_at timestamptz,
  last_bad_message text,
  updated_at timestamptz not null default now()
);

create index if not exists live_chat_moderation_block_idx
  on public.live_chat_moderation(lower(email), block_until desc);

alter table public.live_chat_moderation enable row level security;

drop policy if exists "live_chat_moderation_select_own" on public.live_chat_moderation;
create policy "live_chat_moderation_select_own"
on public.live_chat_moderation
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'smilhytv@gmail.com'
);

drop policy if exists "live_chat_moderation_insert_auth" on public.live_chat_moderation;
create policy "live_chat_moderation_insert_auth"
on public.live_chat_moderation
for insert
to authenticated
with check (true);

drop policy if exists "live_chat_moderation_update_auth" on public.live_chat_moderation;
create policy "live_chat_moderation_update_auth"
on public.live_chat_moderation
for update
to authenticated
using (true)
with check (true);

create or replace function public.betai_chat_profanity_words_v1238()
returns text[]
language sql
immutable
as $$
  select array[
    'kurwa','kurwo','kurwy','kurwie','kurew','kurewski','kurewska','kurwiarz',
    'chuj','chuja','chuje','chujem','chujowy','chujowa','huj','huja','huje',
    'pierdol','pierdolę','pierdole','pierdolony','pierdolona','spierdalaj','wypierdalaj','zapierdala',
    'jebac','jebać','jebie','jebany','jebana','zjeb','zjeba','pojeb','pojebany','pojebana',
    'pizda','pizdo','pizdy','pizde','pizdę','pizdzie',
    'suka','suko','suki','sukinsyn','skurwysyn','skurwiel','skurw',
    'dupa','dupek','dupku','dupka',
    'cwel','cwela','cwele','cwelu',
    'idiota','idiotka','debil','debilu','debile','kretyn','kretynie'
  ]::text[];
$$;

create or replace function public.betai_chat_contains_profanity_v1238(p_text text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_word text;
  v_text text := coalesce(p_text, '');
begin
  foreach v_word in array public.betai_chat_profanity_words_v1238() loop
    if v_text ~* ('(^|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])' || v_word || '($|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])') then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.betai_chat_censor_text_v1238(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v_word text;
  v_result text := coalesce(p_text, '');
  v_dots text;
begin
  foreach v_word in array public.betai_chat_profanity_words_v1238() loop
    v_dots := repeat('•', greatest(char_length(v_word), 3));
    v_result := regexp_replace(
      v_result,
      '(^|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])(' || v_word || ')($|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])',
      '\1' || v_dots || '\3',
      'gi'
    );
  end loop;
  return v_result;
end;
$$;

create or replace function public.betai_live_chat_moderate_before_insert_v1238()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.user_email, '')));
  v_mod public.live_chat_moderation%rowtype;
  v_warning_count integer := 0;
  v_penalty_stage integer := 0;
  v_block_until timestamptz := null;
  v_title text;
  v_body text;
begin
  if v_email = '' then
    return new;
  end if;

  select * into v_mod
  from public.live_chat_moderation
  where lower(email) = v_email
  for update;

  if v_mod.block_until is not null and v_mod.block_until > now() then
    raise exception 'CHAT_BLOCKED_UNTIL:%', v_mod.block_until;
  end if;

  if not public.betai_chat_contains_profanity_v1238(new.message) then
    return new;
  end if;

  new.message := left(public.betai_chat_censor_text_v1238(new.message), 240);

  insert into public.live_chat_moderation(email, warning_count, penalty_stage, block_until, last_warning_at, last_bad_message, updated_at)
  values (v_email, 1, 0, null, now(), left(coalesce(new.message, ''), 240), now())
  on conflict (email) do update
  set warning_count = public.live_chat_moderation.warning_count + 1,
      penalty_stage = case
        when public.live_chat_moderation.warning_count + 1 >= 4 then 2
        when public.live_chat_moderation.warning_count + 1 >= 3 then greatest(public.live_chat_moderation.penalty_stage, 1)
        else public.live_chat_moderation.penalty_stage
      end,
      block_until = case
        when public.live_chat_moderation.warning_count + 1 >= 4 then now() + interval '7 days'
        when public.live_chat_moderation.warning_count + 1 >= 3 and coalesce(public.live_chat_moderation.penalty_stage, 0) < 1 then now() + interval '24 hours'
        when public.live_chat_moderation.warning_count + 1 >= 3 then greatest(coalesce(public.live_chat_moderation.block_until, now()), now() + interval '24 hours')
        else public.live_chat_moderation.block_until
      end,
      last_warning_at = now(),
      last_bad_message = left(coalesce(excluded.last_bad_message, ''), 240),
      updated_at = now()
  returning warning_count, penalty_stage, block_until
  into v_warning_count, v_penalty_stage, v_block_until;

  if v_block_until is not null and v_block_until > now() and v_penalty_stage >= 2 then
    v_title := 'Blokada czatu na 7 dni';
    v_body := 'Otrzymałeś kolejną blokadę za przekleństwa. Czat jest zablokowany do ' || to_char(v_block_until, 'YYYY-MM-DD HH24:MI') || '. Po powrocie pisz bez obraźliwych słów.';
  elsif v_block_until is not null and v_block_until > now() then
    v_title := 'Blokada czatu na 24h';
    v_body := 'To jest 3 ostrzeżenie za przekleństwa. Czat jest zablokowany do ' || to_char(v_block_until, 'YYYY-MM-DD HH24:MI') || '. Po kolejnych przekleństwach blokada wyniesie 7 dni.';
  else
    v_title := 'Ostrzeżenie za przekleństwa na czacie';
    v_body := 'Nie wolno używać przekleństw na czacie BetAI. Twoja wiadomość została wykropkowana. Ostrzeżenie ' || v_warning_count || '/3. Po 3 ostrzeżeniach czat zostanie zablokowany na 24h.';
  end if;

  insert into public.betai_system_notifications(recipient_email, title, body, message, reward_tokens, sent_by, is_read, created_at)
  values (v_email, v_title, v_body, v_body, 0, 'betai', false, now());

  return new;
end;
$$;

drop trigger if exists betai_live_chat_moderate_before_insert_v1238 on public.live_chat_messages;
create trigger betai_live_chat_moderate_before_insert_v1238
before insert on public.live_chat_messages
for each row
execute function public.betai_live_chat_moderate_before_insert_v1238();

-- Pomocniczy podgląd statusu blokady dla UI / admina.
create or replace function public.betai_live_chat_my_moderation_status_v1238()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_row public.live_chat_moderation%rowtype;
begin
  if v_email = '' then
    return jsonb_build_object('warning_count', 0, 'blocked', false, 'block_until', null);
  end if;

  select * into v_row from public.live_chat_moderation where lower(email) = v_email;
  if not found then
    return jsonb_build_object('warning_count', 0, 'blocked', false, 'block_until', null);
  end if;

  return jsonb_build_object(
    'warning_count', coalesce(v_row.warning_count, 0),
    'penalty_stage', coalesce(v_row.penalty_stage, 0),
    'blocked', v_row.block_until is not null and v_row.block_until > now(),
    'block_until', v_row.block_until
  );
end;
$$;
