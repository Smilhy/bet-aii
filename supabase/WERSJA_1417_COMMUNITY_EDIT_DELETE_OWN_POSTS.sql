-- WERSJA 1417 — SPOŁECZNOŚĆ: EDYCJA I USUWANIE WŁASNYCH POSTÓW
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Dodaje bezpieczne funkcje RPC:
-- - update_community_post_v1417(post_id, body)
-- - delete_community_post_v1417(post_id)
--
-- Użytkownik może edytować/usunąć tylko swój post.
-- Admin może usunąć/edytować przez is_admin w public.profiles.

create extension if not exists pgcrypto;

alter table if exists public.community_posts add column if not exists updated_at timestamptz;

create or replace function public.betai_is_admin_v1417(p_user_id uuid)
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

create or replace function public.update_community_post_v1417(
  p_post_id uuid,
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

  if p_post_id is null then
    raise exception 'missing post id';
  end if;

  if v_clean = '' then
    raise exception 'empty body';
  end if;

  select author_id into v_owner
  from public.community_posts
  where id = p_post_id
  limit 1;

  if v_owner is null then
    raise exception 'post not found';
  end if;

  v_is_admin := public.betai_is_admin_v1417(auth.uid());

  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed';
  end if;

  update public.community_posts
  set body = left(v_clean, 5000),
      updated_at = now()
  where id = p_post_id;

  return jsonb_build_object('ok', true, 'post_id', p_post_id);
end;
$$;

create or replace function public.delete_community_post_v1417(
  p_post_id uuid
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

  if p_post_id is null then
    raise exception 'missing post id';
  end if;

  select author_id into v_owner
  from public.community_posts
  where id = p_post_id
  limit 1;

  if v_owner is null then
    raise exception 'post not found';
  end if;

  v_is_admin := public.betai_is_admin_v1417(auth.uid());

  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed';
  end if;

  delete from public.community_reactions where post_id = p_post_id;
  delete from public.community_comments where post_id = p_post_id;
  delete from public.community_posts where id = p_post_id;

  return jsonb_build_object('ok', true, 'post_id', p_post_id);
end;
$$;

grant execute on function public.betai_is_admin_v1417(uuid) to authenticated;
grant execute on function public.update_community_post_v1417(uuid, text) to authenticated;
grant execute on function public.delete_community_post_v1417(uuid) to authenticated;

select 'WERSJA 1417 community edit/delete own posts ready' as status;
