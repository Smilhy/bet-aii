-- BET+AI — WERSJA 1782
-- Jednorazowa korekta istniejącego typu Brazil — Morocco.
-- Błędny zapis 2026-06-13 23:00Z oznaczał 01:00 PL.
-- Prawidłowy start: 2026-06-13 22:00Z = 14.06.2026 00:00 Europe/Warsaw.

begin;

-- Wersja dla kolumn timestamp/timestamptz.
-- Aktualizujemy wyłącznie wskazany mecz i tylko rekordy z błędną godziną.
do $$
declare
  column_name text;
  column_type text;
begin
  foreach column_name in array array['match_time','event_time','kickoff_time']
  loop
    select c.data_type
      into column_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'tips'
      and c.column_name = column_name;

    if column_type is null then
      continue;
    end if;

    if column_type in ('timestamp with time zone', 'timestamp without time zone') then
      execute format(
        'update public.tips t
         set %1$I = timestamptz ''2026-06-13 22:00:00+00''
         where (
           lower(coalesce(t.match, '''')) like ''%%brazil%%morocco%%''
           or lower(coalesce(t.match, '''')) like ''%%brazyl%%maroko%%''
           or (
             lower(coalesce(t.team_home, '''')) in (''brazil'', ''brazyl'')
             and lower(coalesce(t.team_away, '''')) in (''morocco'', ''maroko'')
           )
         )
         and (%1$I)::timestamptz >= timestamptz ''2026-06-13 22:50:00+00''
         and (%1$I)::timestamptz <= timestamptz ''2026-06-13 23:10:00+00''',
        column_name
      );
    elsif column_type in ('text', 'character varying', 'character') then
      execute format(
        'update public.tips t
         set %1$I = ''2026-06-13T22:00:00.000Z''
         where (
           lower(coalesce(t.match, '''')) like ''%%brazil%%morocco%%''
           or lower(coalesce(t.match, '''')) like ''%%brazyl%%maroko%%''
           or (
             lower(coalesce(t.team_home, '''')) in (''brazil'', ''brazyl'')
             and lower(coalesce(t.team_away, '''')) in (''morocco'', ''maroko'')
           )
         )
         and coalesce(%1$I, '''') like ''2026-06-13T23:00%%''',
        column_name
      );
    end if;
  end loop;
end $$;

commit;

-- Kontrola:
select
  id,
  match,
  team_home,
  team_away,
  match_time,
  event_time,
  kickoff_time
from public.tips
where
  lower(coalesce(match, '')) like '%brazil%morocco%'
  or lower(coalesce(match, '')) like '%brazyl%maroko%'
  or (
    lower(coalesce(team_home, '')) in ('brazil', 'brazyl')
    and lower(coalesce(team_away, '')) in ('morocco', 'maroko')
  )
order by created_at desc;
