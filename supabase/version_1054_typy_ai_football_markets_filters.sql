-- supabase/version_1054_typy_ai_football_markets_filters.sql
-- Typy AI 1054: football-only, market engine, filtry kurs/prawdopodobieństwo/EV.
-- Bezpieczne dopięcie kolumn. Nie rusza finansów, wypłat, Stripe ani auto-settle.

create extension if not exists pgcrypto;

alter table if exists public.tips add column if not exists ai_external_key text;
alter table if exists public.tips add column if not exists ai_source text;
alter table if exists public.tips add column if not exists ai_model_version text;
alter table if exists public.tips add column if not exists ai_score numeric default 0;
alter table if exists public.tips add column if not exists ai_confidence numeric default 0;
alter table if exists public.tips add column if not exists value_score numeric default 0;
alter table if exists public.tips add column if not exists probability numeric default 0;
alter table if exists public.tips add column if not exists risk_level text;
alter table if exists public.tips add column if not exists ai_analysis text;
alter table if exists public.tips add column if not exists curiosity text;
alter table if exists public.tips add column if not exists live_score_home integer default 0;
alter table if exists public.tips add column if not exists live_score_away integer default 0;

create index if not exists tips_ai_external_key_idx_v1054 on public.tips(ai_external_key);
create index if not exists tips_ai_market_stats_idx_v1054 on public.tips(sport, league, market, odds, ai_score, value_score, status);

select 'v1054 typy ai football markets filters ready' as status;
