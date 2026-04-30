-- =========================================
-- BETAI TAB LOCKS V218
-- opcjonalna blokada sekcji premium bez subskrypcji
-- =========================================

alter table public.betai_typer_subscription_settings
  add column if not exists lock_tips_for_subscribers boolean not null default false;

alter table public.betai_typer_subscription_settings
  add column if not exists updated_at timestamptz not null default now();

update public.betai_typer_subscription_settings
set lock_tips_for_subscribers = coalesce(lock_tips_for_subscribers, false),
    updated_at = now()
where lock_tips_for_subscribers is distinct from coalesce(lock_tips_for_subscribers, false);

grant select, insert, update on public.betai_typer_subscription_settings to anon, authenticated;
grant select on public.betai_typer_active_subscriptions to anon, authenticated;
