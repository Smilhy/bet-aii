-- WERSJA 1438 — TYPY AI: REALISTYCZNA NORMALIZACJA SCORE / EV
-- Wklej w Supabase SQL Editor i uruchom.
--
-- Cel:
-- - stare zapisane typy AI miały często sztuczne 90–93/100 i EV +20%,
-- - ten SQL łagodnie normalizuje już zapisane rekordy w tabeli tips,
-- - frontend 1438 dodatkowo normalizuje wyświetlanie nowych i starych typów.
--
-- Nie usuwa danych.

create extension if not exists pgcrypto;

alter table public.tips add column if not exists ai_score numeric;
alter table public.tips add column if not exists ai_confidence numeric;
alter table public.tips add column if not exists probability numeric;
alter table public.tips add column if not exists value_score numeric;
alter table public.tips add column if not exists odds numeric;
alter table public.tips add column if not exists risk_level text;
alter table public.tips add column if not exists updated_at timestamptz;

create or replace function public.betai_normalize_ai_score_v1438(
  p_score numeric,
  p_probability numeric,
  p_ev numeric,
  p_odds numeric
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_odds numeric := greatest(1.01, least(20, coalesce(p_odds, 1.8)));
  v_prob numeric := greatest(45, least(86, coalesce(p_probability, p_score, 60) * 0.92 + 4));
  v_ev numeric := greatest(-10, least(16, coalesce(p_ev, 0) * 0.55));
  v_penalty numeric := 0;
  v_score numeric;
  v_risk text;
begin
  if v_odds < 1.35 then
    v_penalty := 11;
  elsif v_odds < 1.50 then
    v_penalty := 8;
  elsif v_odds < 1.65 then
    v_penalty := 5;
  elsif v_odds > 3.25 then
    v_penalty := 7;
  elsif v_odds > 2.50 then
    v_penalty := 4;
  end if;

  if v_odds < 1.50 then
    v_ev := greatest(-8, least(9, v_ev));
  elsif v_odds < 1.70 then
    v_ev := greatest(-8, least(12, v_ev));
  end if;

  v_score := round(48 + (v_prob - 50) * 0.52 + v_ev * 0.85 - v_penalty);
  v_score := greatest(58, least(
    case when v_prob >= 82 and v_ev >= 10 and v_odds >= 1.55 and v_odds <= 2.30 then 91 else 86 end,
    v_score
  ));

  v_risk := case
    when v_odds > 2.45 or v_prob < 63 or v_ev < 0 then 'Podwyższone'
    when v_score >= 82 and v_ev >= 7 then 'Niskie'
    else 'Średnie'
  end;

  return jsonb_build_object(
    'score', v_score::integer,
    'probability', round(v_prob)::integer,
    'ev', round(v_ev)::integer,
    'risk', v_risk
  );
end;
$$;

with normalized as (
  select
    id,
    public.betai_normalize_ai_score_v1438(
      ai_score,
      probability,
      value_score,
      odds
    ) as n
  from public.tips
  where
    lower(coalesce(ai_source, '')) like '%ai%'
    or lower(coalesce(source, '')) like '%ai%'
    or lower(coalesce(source, '')) like '%live_ai%'
)
update public.tips t
set
  ai_score = (n.n->>'score')::numeric,
  ai_confidence = (n.n->>'score')::numeric,
  probability = (n.n->>'probability')::numeric,
  value_score = (n.n->>'ev')::numeric,
  risk_level = n.n->>'risk',
  updated_at = now()
from normalized n
where t.id = n.id;

notify pgrst, 'reload schema';

select 'WERSJA 1438 ai score normalization ready' as status;
