-- WERSJA 1418 — SPOŁECZNOŚĆ: EDYCJA/USUWANIE KOMENTARZY I WIADOMOŚCI CZATU
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Dodaje bezpieczne funkcje RPC:
-- - update_community_comment_v1418(comment_id, body)
-- - delete_community_comment_v1418(comment_id)
-- - update_community_chat_message_v1418(message_id, body)
-- - delete_community_chat_message_v1418(message_id)
--
-- Użytkownik może edytować/usunąć tylko swoje komentarze i wiadomości.
-- Admin może edytować/usuwać wszystkie przez is_admin w public.profiles.

create extension if not exists pgcrypto;

alter table if exists public.community_comments add column if not exists updated_at timestamptz;
alter table if exists public.community_chat_messages add column if not exists updated_at timestamptz;

create or replace function public.betai_is_admin_v1418(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select is_admin
    from public.profiles
    where id = p_user_id
    limit 1
  ), false);
$$;

create or replace function public.update_community_comment_v1418(
  p_comment_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_clean text := trim(coalesce(p_body, ''));
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_comment_id is null then
    raise exception 'missing comment id';
  end if;

  if v_clean = '' then
    raise exception 'empty body';
  end if;

  select author_id into v_owner
  from public.community_comments
  where id = p_comment_id
  limit 1;

  if v_owner is null then
    raise exception 'comment not found';
  end if;

  v_is_admin := public.betai_is_admin_v1418(auth.uid());

  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed';
  end if;

  update public.community_comments
  set body = left(v_clean, 3000),
      updated_at = now()
  where id = p_comment_id;

  return jsonb_build_object('ok', true, 'comment_id', p_comment_id);
end;
$$;

create or replace function public.delete_community_comment_v1418(
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_comment_id is null then
    raise exception 'missing comment id';
  end if;

  select author_id into v_owner
  from public.community_comments
  where id = p_comment_id
  limit 1;

  if v_owner is null then
    raise exception 'comment not found';
  end if;

  v_is_admin := public.betai_is_admin_v1418(auth.uid());

  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed';
  end if;

  delete from public.community_comments where id = p_comment_id;

  return jsonb_build_object('ok', true, 'comment_id', p_comment_id);
end;
$$;

create or replace function public.update_community_chat_message_v1418(
  p_message_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_clean text := trim(coalesce(p_body, ''));
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_message_id is null then
    raise exception 'missing message id';
  end if;

  if v_clean = '' then
    raise exception 'empty body';
  end if;

  select author_id into v_owner
  from public.community_chat_messages
  where id = p_message_id
  limit 1;

  if v_owner is null then
    raise exception 'message not found';
  end if;

  v_is_admin := public.betai_is_admin_v1418(auth.uid());

  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed';
  end if;

  update public.community_chat_messages
  set body = left(v_clean, 120000),
      updated_at = now()
  where id = p_message_id;

  return jsonb_build_object('ok', true, 'message_id', p_message_id);
end;
$$;

create or replace function public.delete_community_chat_message_v1418(
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_message_id is null then
    raise exception 'missing message id';
  end if;

  select author_id into v_owner
  from public.community_chat_messages
  where id = p_message_id
  limit 1;

  if v_owner is null then
    raise exception 'message not found';
  end if;

  v_is_admin := public.betai_is_admin_v1418(auth.uid());

  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed';
  end if;

  delete from public.community_chat_messages where id = p_message_id;

  return jsonb_build_object('ok', true, 'message_id', p_message_id);
end;
$$;

grant execute on function public.betai_is_admin_v1418(uuid) to authenticated;
grant execute on function public.update_community_comment_v1418(uuid, text) to authenticated;
grant execute on function public.delete_community_comment_v1418(uuid) to authenticated;
grant execute on function public.update_community_chat_message_v1418(uuid, text) to authenticated;
grant execute on function public.delete_community_chat_message_v1418(uuid) to authenticated;

select 'WERSJA 1418 community comments and chat edit/delete ready' as status;
