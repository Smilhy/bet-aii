-- WERSJA 981 — RESET OD ZERA + BLOKADA TOŻSAMOŚCI I STATYSTYK DLA WSZYSTKICH
-- Uruchom w Supabase SQL Editor.
--
-- Co robi:
-- 1. Czyści typy i odblokowane/kupione typy, jeśli takie tabele istnieją.
-- 2. Zeruje statystyki w public.profiles.
-- 3. Zakłada jedną funkcję liczenia statystyk dla wszystkich.
-- 4. Zakłada trigger, żeby po każdym nowym typie/rozliczeniu/usunięciu staty same się zapisywały.
--
-- Nie usuwa:
-- - kont użytkowników,
-- - profili,
-- - opisów profili,
-- - avatarów,
-- - obserwujących,
-- - salda/coinów,
-- - wiadomości/chatu.

begin;

-- Zdejmujemy trigger na czas czyszczenia, żeby nie przeliczać statystyk po każdym kasowanym rekordzie.
drop trigger if exists trg_recalculate_profile_tip_stats on public.tips;

-- Czyść zależne tabele tylko jeśli istnieją.
do $func$
begin
  if to_regclass('public.unlocked_tips') is not null then
    execute 'delete from public.unlocked_tips';
  end if;

  if to_regclass('public.purchased_tips') is not null then
    execute 'delete from public.purchased_tips';
  end if;

  if to_regclass('public.single_tip_purchases') is not null then
    execute 'delete from public.single_tip_purchases';
  end if;

  if to_regclass('public.tip_unlocks') is not null then
    execute 'delete from public.tip_unlocks';
  end if;

  if to_regclass('public.tip_comments') is not null then
    execute 'delete from public.tip_comments';
  end if;

  if to_regclass('public.tip_likes') is not null then
    execute 'delete from public.tip_likes';
  end if;

  if to_regclass('public.tip_reactions') is not null then
    execute 'delete from public.tip_reactions';
  end if;
end;
$func$;

-- Główne czyszczenie typów.
delete from public.tips;

-- Upewnij się, że kolumny statystyk istnieją.
alter table public.profiles add column if not exists imported_yield numeric default 0;
alter table public.profiles add column if not exists imported_total_tips integer default 0;
alter table public.profiles add column if not exists imported_won_tips integer default 0;
alter table public.profiles add column if not exists imported_lost_tips integer default 0;
alter table public.profiles add column if not exists imported_pending_tips integer default 0;
alter table public.profiles add column if not exists imported_total_staked numeric default 0;
alter table public.profiles add column if not exists imported_profit numeric default 0;
alter table public.profiles add column if not exists imported_avg_odds numeric default 0;
alter table public.profiles add column if not exists imported_highest_odds numeric default 0;
alter table public.profiles add column if not exists imported_tips_amount numeric default 0;
alter table public.profiles add column if not exists imported_tips_currency text default 'zł';
alter table public.profiles add column if not exists stats_imported_at timestamptz;

-- Upewnij się, że identyfikacja profilu ma stabilne pola.
alter table public.profiles add column if not exists public_slug text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- 🔒 BLOKADA TOŻSAMOŚCI: napraw generic username typu "user", jeśli da się wziąć nick z public_slug albo emaila.
update public.profiles
set
  username = coalesce(
    nullif(public_slug, ''),
    nullif(split_part(email, '@', 1), ''),
    nullif(username, '')
  ),
  public_slug = coalesce(
    nullif(public_slug, ''),
    nullif(username, ''),
    nullif(split_part(email, '@', 1), '')
  ),
  updated_at = now()
where lower(coalesce(username, '')) in ('', 'user', 'użytkownik', 'uzytkownik')
  and (
    nullif(public_slug, '') is not null
    or nullif(email, '') is not null
  );

-- Reset statystyk dla wszystkich.
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
  imported_tips_currency = coalesce(imported_tips_currency, 'zł'),
  stats_imported_at = null;

-- Jedna funkcja statystyk dla całej strony.
-- ZASADA:
-- Typy = wszystkie typy.
-- Wygrane/przegrane = tylko rozliczone.
-- Pending = nierozliczone.
-- Profit/Bilans = tylko rozliczone.
-- Stawka do Yield/ROI = tylko rozliczone.
-- Pending NIE wchodzi do Yield/ROI.
drop function if exists public.handle_tip_stats_recalculate();
drop function if exists public.recalculate_profile_tip_stats(uuid);

create or replace function public.recalculate_profile_tip_stats(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  update public.profiles p
  set
    imported_total_tips = coalesce(s.total_tips, 0),
    imported_won_tips = coalesce(s.won_tips, 0),
    imported_lost_tips = coalesce(s.lost_tips, 0),
    imported_pending_tips = coalesce(s.pending_tips, 0),

    -- WAŻNE: to jest stawka ROZLICZONA, nie wszystkie pendingi.
    imported_total_staked = coalesce(s.settled_staked, 0),

    imported_profit = coalesce(s.profit, 0),
    imported_avg_odds = coalesce(s.avg_odds, 0),
    imported_highest_odds = coalesce(s.highest_odds, 0),
    imported_yield = case
      when coalesce(s.settled_staked, 0) > 0
      then round((coalesce(s.profit, 0) / s.settled_staked) * 100, 2)
      else 0
    end,
    imported_tips_amount = coalesce(s.total_tips, 0),
    stats_imported_at = now()
  from (
    select
      x.author_id,
      count(*)::int as total_tips,
      count(*) filter (where x.status_norm = 'won')::int as won_tips,
      count(*) filter (where x.status_norm = 'lost')::int as lost_tips,
      count(*) filter (where x.status_norm not in ('won', 'lost', 'void'))::int as pending_tips,

      coalesce(sum(
        case when x.status_norm in ('won', 'lost') then x.stake else 0 end
      ), 0)::numeric as settled_staked,

      coalesce(sum(
        case
          when x.status_norm = 'won' then x.stake * greatest(x.odds - 1, 0)
          when x.status_norm = 'lost' then -x.stake
          else 0
        end
      ), 0)::numeric as profit,

      coalesce(avg(nullif(x.odds, 0)), 0)::numeric as avg_odds,
      coalesce(max(x.odds), 0)::numeric as highest_odds

    from (
      select
        t.author_id,

        case
          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
            ('won','win','wygrany','wygrana','wygrał','wygral','green','success')
          then 'won'

          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
            ('lost','loss','lose','przegrany','przegrana','przegrał','przegral','red','failed')
          then 'lost'

          when lower(coalesce(to_jsonb(t)->>'status', to_jsonb(t)->>'result', to_jsonb(t)->>'result_status', '')) in
            ('void','push','zwrot','return','cancelled','canceled','anulowany')
          then 'void'

          else 'pending'
        end as status_norm,

        coalesce(nullif(to_jsonb(t)->>'stake', '')::numeric, 0) as stake,
        coalesce(nullif(to_jsonb(t)->>'odds', '')::numeric, 0) as odds

      from public.tips t
      where t.author_id = p_profile_id
    ) x
    group by x.author_id
  ) s
  where p.id = p_profile_id
    and p.id = s.author_id;

  -- Jeśli nie ma żadnych typów, staty muszą być zero.
  update public.profiles p
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
    stats_imported_at = now()
  where p.id = p_profile_id
    and not exists (
      select 1
      from public.tips t
      where t.author_id = p_profile_id
    );
end;
$func$;

create or replace function public.handle_tip_stats_recalculate()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  affected_author uuid;
begin
  if tg_op = 'DELETE' then
    affected_author := old.author_id;
  else
    affected_author := new.author_id;
  end if;

  if affected_author is not null then
    perform public.recalculate_profile_tip_stats(affected_author);
  end if;

  return coalesce(new, old);
end;
$func$;

create trigger trg_recalculate_profile_tip_stats
after insert or update or delete on public.tips
for each row
execute function public.handle_tip_stats_recalculate();

-- Po resecie typów i tak wszystko jest zero, ale zostawiamy przeliczenie jako zabezpieczenie.
do $func$
declare
  r record;
begin
  for r in
    select id
    from public.profiles
  loop
    perform public.recalculate_profile_tip_stats(r.id);
  end loop;
end;
$func$;


-- 🔒 DODATKOWA BLOKADA NA PRZYSZŁOŚĆ:
-- Jeśli ktoś zapisze username='user', baza spróbuje utrzymać stabilny public_slug/email-local.
create or replace function public.lock_profile_identity_v981()
returns trigger
language plpgsql
as $func$
begin
  if lower(coalesce(new.username, '')) in ('', 'user', 'użytkownik', 'uzytkownik') then
    new.username = coalesce(
      nullif(new.public_slug, ''),
      nullif(split_part(new.email, '@', 1), ''),
      new.username
    );
  end if;

  if coalesce(new.public_slug, '') = '' then
    new.public_slug = coalesce(
      nullif(new.username, ''),
      nullif(split_part(new.email, '@', 1), '')
    );
  end if;

  new.updated_at = now();
  return new;
end;
$func$;

drop trigger if exists trg_lock_profile_identity_v981 on public.profiles;

create trigger trg_lock_profile_identity_v981
before insert or update of username, public_slug, email on public.profiles
for each row
execute function public.lock_profile_identity_v981();

commit;
