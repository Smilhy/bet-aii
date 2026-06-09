-- WERSJA 1663 — opcjonalne techniczne klucze rynku do bezpieczniejszego auto-rozliczania.
-- Ten SQL nie jest wymagany do działania paczki, bo frontend ma fallback gdy kolumn nie ma.
-- Warto odpalić, żeby nowe typy zapisywały market_key / selection_key / settlement_mode.

alter table public.tips add column if not exists market_key text;
alter table public.tips add column if not exists selection_key text;
alter table public.tips add column if not exists settlement_mode text default 'auto';

create index if not exists tips_market_key_idx on public.tips(market_key);
create index if not exists tips_selection_key_idx on public.tips(selection_key);
create index if not exists tips_settlement_mode_idx on public.tips(settlement_mode);

select 'WERSJA 1663 MARKET KEYS OPTIONAL OK' as status;
