-- WERSJA 1022 — MISJE DZIENNE 24H
-- Brak nowych tabel.
-- Misje dzienne używają istniejącej funkcji public.claim_community_reward_v1008 z wersji 1021.
-- Każda misja ma osobny reward_key:
-- daily_chat, daily_post, daily_active
-- Każda jest blokowana na 24h przez SQL 1021.
select 'v1022 daily missions claims 24h ready' as status;
