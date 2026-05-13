-- WERSJA 970 — reset typów i statystyk całej strony bez błędu na widokach
-- Uruchom w Supabase SQL Editor.
-- Resetuje typy/statystyki, ale NIE usuwa logiki, użytkowników, profili, subskrypcji, cen ani ustawień.
-- Poprawka: tipster_ranking może być widokiem, dlatego TRUNCATE wykonuje się tylko na prawdziwych tabelach.

begin;

-- Najpierw usuń rzeczy zależne od typów.
delete from public.unlocked_tips;
delete from public.tips;

-- Wyczyść statystyki profili/importowane statystyki.
update public.profiles
set
  imported_yield = 0,
  imported_total_tips = 0,
  imported_won_tips = 0,
  imported_lost_tips = 0,
  imported_pending_tips = 0,
  imported_total_staked = 0,
  imported_profit = 0,
  imported_avg_odds = 0,
  imported_highest_odds = 0,
  imported_tips_amount = 0,
  stats_imported_at = null;

-- Czyść tylko prawdziwe tabele. Widoki/materialized views pomija.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tipster_ranking',
    'tipster_ranking_live',
    'stats_by_league',
    'stats_by_type',
    'stats_recent_form'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relkind in ('r', 'p')
    ) then
      execute format('truncate table public.%I restart identity cascade', table_name);
    end if;
  end loop;
end $$;

commit;
