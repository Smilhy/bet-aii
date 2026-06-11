
-- supabase/version_1024_community_post_reports_and_owner_actions.sql
-- Menu posta:
-- - autor może edytować/usunąć swój post,
-- - użytkownik może zgłosić cudzy post,
-- - tabela zgłoszeń community_post_reports.

create extension if not exists pgcrypto;

alter table if exists public.community_posts
  add column if not exists updated_at timestamptz;

create table if not exists public.community_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_email text not null,
  reported_author_id uuid,
  reported_author_email text,
  reason text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.community_post_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_post_reports'
      and policyname='community_post_reports_insert_own_v1024'
  ) then
    create policy community_post_reports_insert_own_v1024
    on public.community_post_reports
    for insert
    with check (
      auth.uid() = reporter_id
      or lower(reporter_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_post_reports'
      and policyname='community_post_reports_select_own_v1024'
  ) then
    create policy community_post_reports_select_own_v1024
    on public.community_post_reports
    for select
    using (
      auth.uid() = reporter_id
      or lower(reporter_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

-- Owner policies for post update/delete, added only if missing.
alter table if exists public.community_posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_posts'
      and policyname='community_posts_update_own_v1024'
  ) then
    create policy community_posts_update_own_v1024
    on public.community_posts
    for update
    using (
      auth.uid() = author_id
      or lower(author_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    with check (
      auth.uid() = author_id
      or lower(author_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='community_posts'
      and policyname='community_posts_delete_own_v1024'
  ) then
    create policy community_posts_delete_own_v1024
    on public.community_posts
    for delete
    using (
      auth.uid() = author_id
      or lower(author_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  end if;
end $$;

select 'v1024 community post menu edit delete report ready' as status;
