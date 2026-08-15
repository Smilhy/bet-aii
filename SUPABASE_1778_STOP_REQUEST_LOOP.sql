-- ============================================================
-- BET+AI — WERSJA 1778
-- STOP PĘTLI REQUESTÓW get_tipster_achievements_v1774
--
-- Przyczyna:
-- stara funkcja GET wykonywała refresh/upsert,
-- upsert wywoływał Realtime,
-- Realtime ponownie wykonywał GET,
-- przez co powstawała nieskończona pętla.
--
-- Uruchom cały kod jeden raz w Supabase SQL Editor.
-- ============================================================

begin;

-- GET ma tylko CZYTAĆ. Nie może zapisywać ani odświeżać tabeli.
create or replace function public.get_tipster_achievements_v1774(
  p_user_id uuid
)
returns setof public.tipster_achievement_progress
language sql
stable
security definer
set search_path = public
as $$
  select progress.*
  from public.tipster_achievement_progress progress
  where progress.user_id = p_user_id
  order by progress.sort_order;
$$;

grant execute
on function public.get_tipster_achievements_v1774(uuid)
to anon, authenticated;

-- Blokujemy ręczne wywołanie kosztownego refreshu z przeglądarki.
-- Triggery działają dalej, bo wykonują się po stronie bazy.
revoke execute
on function public.refresh_tipster_achievements_v1774(uuid)
from public, anon, authenticated;

commit;

-- Kontrola: powinien być zwykły odczyt bez zapisu.
select
  p.proname as function_name,
  p.provolatile as volatility,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_tipster_achievements_v1774';
