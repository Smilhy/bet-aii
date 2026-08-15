-- BET+AI — WERSJA 1793
-- Naprawia już zapisany typ Australia — Türkiye,
-- który przez stary stan formularza został zapisany jako "Haiti wygra".
-- Uruchom raz w Supabase SQL Editor.

begin;

do $$
declare
  v_col text;
begin
  -- Tekst wyboru może być zapisany w różnych kolumnach zależnie od wersji tabeli.
  foreach v_col in array array['prediction', 'bet_type', 'pick']
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tips'
        and column_name = v_col
    ) then
      execute format($sql$
        update public.tips t
        set %1$I = 'Türkiye wygra'
        where lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
          and (
            lower(coalesce(to_jsonb(t)->>'match', '')) like '%%australia%%türkiye%%'
            or lower(coalesce(to_jsonb(t)->>'match', '')) like '%%australia%%turkiye%%'
            or lower(coalesce(to_jsonb(t)->>'match', '')) like '%%australia%%turcja%%'
            or lower(coalesce(to_jsonb(t)->>'match', '')) like '%%australia%%turkey%%'
          )
          and lower(coalesce(to_jsonb(t)->>%2$L, '')) like '%%haiti%%'
      $sql$, v_col, v_col);
    end if;
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tips' and column_name = 'market_key'
  ) then
    execute $sql$
      update public.tips t
      set market_key = 'match_winner'
      where lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
        and lower(coalesce(to_jsonb(t)->>'match', '')) like '%australia%'
        and (
          lower(coalesce(to_jsonb(t)->>'match', '')) like '%türkiye%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turkiye%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turcja%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turkey%'
        )
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tips' and column_name = 'selection_key'
  ) then
    execute $sql$
      update public.tips t
      set selection_key = 'away'
      where lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
        and lower(coalesce(to_jsonb(t)->>'match', '')) like '%australia%'
        and (
          lower(coalesce(to_jsonb(t)->>'match', '')) like '%türkiye%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turkiye%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turcja%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turkey%'
        )
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tips' and column_name = 'settlement_mode'
  ) then
    execute $sql$
      update public.tips t
      set settlement_mode = 'auto'
      where lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
        and lower(coalesce(to_jsonb(t)->>'match', '')) like '%australia%'
        and (
          lower(coalesce(to_jsonb(t)->>'match', '')) like '%türkiye%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turkiye%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turcja%'
          or lower(coalesce(to_jsonb(t)->>'match', '')) like '%turkey%'
        )
    $sql$;
  end if;
end $$;

commit;

select
  t.id,
  coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username') as autor,
  to_jsonb(t)->>'match' as mecz,
  coalesce(to_jsonb(t)->>'prediction', to_jsonb(t)->>'bet_type', to_jsonb(t)->>'pick') as typ,
  to_jsonb(t)->>'odds' as kurs,
  to_jsonb(t)->>'market_key' as market_key,
  to_jsonb(t)->>'selection_key' as selection_key,
  to_jsonb(t)->>'settlement_mode' as settlement_mode,
  to_jsonb(t)->>'status' as status
from public.tips t
where lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
  and lower(coalesce(to_jsonb(t)->>'match', '')) like '%australia%'
order by t.created_at desc;
