-- WERSJA 984 — CORE LOCK v983
-- Ten plik NIE zmienia matematyki. To dokumentacyjna blokada rdzenia.
--
-- Zamrożone:
-- 1. Tożsamość profilu:
--    id / email / public_slug są źródłem prawdy.
--    username='user/użytkownik/uzytkownik' nie jest prawdziwym nickiem.
-- 2. Statystyki:
--    Typy = wszystkie.
--    Pending = nierozliczone.
--    Profit/Bilans = tylko rozliczone.
--    Stawka do Yield/ROI = tylko rozliczone.
--    Pending nie wchodzi do Yield/ROI.
-- 3. Realtime:
--    tips i profiles mają działać bez F5.
--
-- Ten SQL tylko upewnia się, że istnieją aktywne mechanizmy z wersji 981-983.

begin;

-- Realtime musi mieć pełny rekord.
alter table public.tips replica identity full;
alter table public.profiles replica identity full;

-- Dodanie do publikacji realtime, jeśli brakuje.
do $func$
begin
  begin
    alter publication supabase_realtime add table public.tips;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;

  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;
end;
$func$;

-- Kontrola: funkcje/trigger powinny istnieć po wersjach 981-983.
do $func$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'recalculate_profile_tip_stats'
  ) then
    raise notice 'UWAGA: Brakuje public.recalculate_profile_tip_stats(uuid). Uruchom najpierw SQL v981.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_recalculate_profile_tip_stats'
  ) then
    raise notice 'UWAGA: Brakuje triggera trg_recalculate_profile_tip_stats. Uruchom najpierw SQL v981.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname in ('trg_lock_profile_identity_v982', 'trg_lock_profile_identity_v981')
  ) then
    raise notice 'UWAGA: Brakuje triggera blokady tożsamości profilu. Uruchom SQL v982.';
  end if;
end;
$func$;

commit;
