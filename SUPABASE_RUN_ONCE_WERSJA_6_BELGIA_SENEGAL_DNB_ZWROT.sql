-- BETAI WERSJA 6 — NATYCHMIASTOWA NAPRAWA KONKRETNEGO TYPU
-- smilhytv: Belgia — Senegal, Belgia DNB, 2:2 po 90 minutach => VOID / ZWROT
-- Uruchom jeden raz w Supabase SQL Editor po wdrożeniu wersji 6.

begin;

-- Kolumny używane przez automat. IF NOT EXISTS sprawia, że skrypt jest bezpieczny
-- również na starszym wariancie schematu.
alter table if exists public.tips add column if not exists result text;
alter table if exists public.tips add column if not exists result_status text;
alter table if exists public.tips add column if not exists settlement_status text;
alter table if exists public.tips add column if not exists settlement_source text;
alter table if exists public.tips add column if not exists settlement_note text;
alter table if exists public.tips add column if not exists profit numeric default 0;
alter table if exists public.tips add column if not exists payout numeric default 0;
alter table if exists public.tips add column if not exists return_amount numeric default 0;
alter table if exists public.tips add column if not exists settled_at timestamptz;
alter table if exists public.tips add column if not exists updated_at timestamptz default now();
alter table if exists public.tips add column if not exists market_key text;
alter table if exists public.tips add column if not exists selection_key text;

with corrected as (
  update public.tips as t
  set
    status = 'void',
    result = 'void',
    result_status = 'void',
    settlement_status = 'void',
    profit = 0,
    payout = coalesce(
      nullif(to_jsonb(t)->>'stake', '')::numeric,
      nullif(to_jsonb(t)->>'amount', '')::numeric,
      nullif(to_jsonb(t)->>'bet_amount', '')::numeric,
      0
    ),
    return_amount = coalesce(
      nullif(to_jsonb(t)->>'stake', '')::numeric,
      nullif(to_jsonb(t)->>'amount', '')::numeric,
      nullif(to_jsonb(t)->>'bet_amount', '')::numeric,
      0
    ),
    market_key = 'draw_no_bet',
    selection_key = 'home',
    settlement_source = 'manual_dnb_regular_time_fix_v6',
    settlement_note = 'DNB: 2:2 po 90 minutach = zwrot; dogrywka/karne nie są liczone',
    settled_at = now(),
    updated_at = now()
  where
    lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
    and lower(concat_ws(' ',
      to_jsonb(t)->>'match',
      to_jsonb(t)->>'team_home',
      to_jsonb(t)->>'team_away'
    )) like '%belg%'
    and lower(concat_ws(' ',
      to_jsonb(t)->>'match',
      to_jsonb(t)->>'team_home',
      to_jsonb(t)->>'team_away'
    )) like '%senegal%'
    and lower(concat_ws(' ',
      to_jsonb(t)->>'market',
      to_jsonb(t)->>'market_name',
      to_jsonb(t)->>'bet_type',
      to_jsonb(t)->>'prediction',
      to_jsonb(t)->>'selection',
      to_jsonb(t)->>'pick'
    )) ~ '(dnb|draw no bet|remis nie ma)'
  returning id, author_name, status, profit, payout, return_amount, settlement_source
)
select * from corrected;

-- Gdy masz aktywny trigger trg_recalculate_profile_tip_stats, statystyki profilu
-- przeliczą się automatycznie po UPDATE. Poniższy blok jest tylko dodatkowym
-- zabezpieczeniem dla instalacji, w których funkcja istnieje bez triggera.
do $$
declare
  v_author uuid;
begin
  select t.author_id into v_author
  from public.tips t
  where lower(coalesce(to_jsonb(t)->>'author_name', to_jsonb(t)->>'username', '')) = 'smilhytv'
    and lower(concat_ws(' ', to_jsonb(t)->>'match', to_jsonb(t)->>'team_home', to_jsonb(t)->>'team_away')) like '%belg%'
    and lower(concat_ws(' ', to_jsonb(t)->>'match', to_jsonb(t)->>'team_home', to_jsonb(t)->>'team_away')) like '%senegal%'
  order by t.created_at desc
  limit 1;

  if v_author is not null and to_regprocedure('public.recalculate_profile_tip_stats(uuid)') is not null then
    perform public.recalculate_profile_tip_stats(v_author);
  end if;
end $$;

commit;
