-- WERSJA 983 — REALTIME AUTO-REFRESH TYPÓW I STATYSTYK
-- Uruchom w Supabase SQL Editor.
-- Nie zmienia logiki statystyk. Włącza realtime, żeby po dodaniu/rozliczeniu typu UI odświeżał się bez F5.

begin;

-- Pełny rekord przy UPDATE/DELETE jest potrzebny frontendowi.
alter table public.tips replica identity full;
alter table public.profiles replica identity full;

-- Dodaj tabele do publikacji realtime, jeśli jeszcze ich tam nie ma.
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

commit;
