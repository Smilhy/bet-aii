-- BetAI WERSJA 1804 — pełny reset profilu typera/admina smilhytv
-- Uruchom TEN PLIK jeden raz w Supabase -> SQL Editor -> Run.
--
-- Resetuje wyłącznie dane bukmacherskie profilu smilhytv:
--   • wszystkie jego typy/mecze,
--   • zakładki Typy, Wyniki, Historia i Statystyki,
--   • importowane/agregowane statystyki profilu,
--   • postęp osiągnięć zależnych od typów.
--
-- Nie usuwa konta, roli ADMIN, opisu, avatara, portfela, monet,
-- subskrypcji, obserwujących, opinii, poleceń ani ustawień Stripe.

begin;

-- 1) Zbierz wszystkie rekordy, które mogą należeć do smilhytv.
create temporary table betai_v1804_reset_targets (
  id uuid primary key,
  email text,
  username text
) on commit drop;

-- Stały identyfikator z dotychczasowej bazy projektu.
insert into betai_v1804_reset_targets (id, email, username)
values ('1a3f01d7-5675-4abf-b851-6ecec78262f5', 'smilhytv@gmail.com', 'smilhytv')
on conflict (id) do update
set email = excluded.email,
    username = excluded.username;

-- Dodatkowo znajdź konto po aktualnym profilu (chroni przed zmianą UUID/kopią profilu).
insert into betai_v1804_reset_targets (id, email, username)
select
  p.id,
  lower(coalesce(nullif(to_jsonb(p)->>'email', ''), 'smilhytv@gmail.com')),
  lower(coalesce(
    nullif(to_jsonb(p)->>'username', ''),
    nullif(to_jsonb(p)->>'public_slug', ''),
    'smilhytv'
  ))
from public.profiles p
where p.id = '1a3f01d7-5675-4abf-b851-6ecec78262f5'::uuid
   or lower(coalesce(to_jsonb(p)->>'email', '')) = 'smilhytv@gmail.com'
   or lower(coalesce(to_jsonb(p)->>'username', '')) = 'smilhytv'
   or lower(coalesce(to_jsonb(p)->>'public_slug', '')) = 'smilhytv'
on conflict (id) do update
set email = excluded.email,
    username = excluded.username;

-- Zabezpieczenie dla sytuacji, gdy profil ma inny UUID niż w starej paczce.
insert into betai_v1804_reset_targets (id, email, username)
select u.id, lower(u.email), 'smilhytv'
from auth.users u
where lower(coalesce(u.email, '')) = 'smilhytv@gmail.com'
on conflict (id) do update
set email = excluded.email,
    username = excluded.username;

-- 2) Zapamiętaj ID typów przed usunięciem, aby wyczyścić zależne odblokowania.
create temporary table betai_v1804_tip_ids (
  id text primary key
) on commit drop;

do $$
begin
  if to_regclass('public.tips') is not null then
    insert into betai_v1804_tip_ids (id)
    select distinct to_jsonb(t)->>'id'
    from public.tips t
    where coalesce(to_jsonb(t)->>'id', '') <> ''
      and exists (
        select 1
        from betai_v1804_reset_targets r
        where coalesce(to_jsonb(t)->>'author_id', '') = r.id::text
           or coalesce(to_jsonb(t)->>'user_id', '') = r.id::text
           or coalesce(to_jsonb(t)->>'tipster_id', '') = r.id::text
           or lower(coalesce(to_jsonb(t)->>'author_email', '')) = 'smilhytv@gmail.com'
           or lower(coalesce(to_jsonb(t)->>'user_email', '')) = 'smilhytv@gmail.com'
           or lower(coalesce(to_jsonb(t)->>'email', '')) = 'smilhytv@gmail.com'
           or lower(coalesce(to_jsonb(t)->>'author_name', '')) = 'smilhytv'
           or lower(coalesce(to_jsonb(t)->>'username', '')) = 'smilhytv'
           or lower(coalesce(to_jsonb(t)->>'public_slug', '')) = 'smilhytv'
      );
  end if;
end $$;

-- 3) Usuń techniczne odblokowania powiązane ze starymi typami.
-- Płatności i historia finansowa nie są kasowane.
do $$
begin
  if to_regclass('public.unlocked_tips') is not null then
    delete from public.unlocked_tips u
    where coalesce(to_jsonb(u)->>'tip_id', '') in (
      select id from betai_v1804_tip_ids
    );
  end if;
end $$;

-- 4) Usuń wszystkie typy/mecze smilhytv. Widoki historii i wyników wyzerują się automatycznie.
do $$
begin
  if to_regclass('public.tips') is not null then
    delete from public.tips t
    where coalesce(to_jsonb(t)->>'id', '') in (
      select id from betai_v1804_tip_ids
    );
  end if;
end $$;

-- 5) Wyzeruj wszystkie znane kolumny statystyczne profilu, ale tylko jeśli istnieją.
do $$
declare
  set_clause text;
begin
  select string_agg(
    format(
      '%I = %s',
      c.column_name,
      case
        when c.column_name in ('stats_imported_at', 'imported_at') then 'null'
        when c.udt_name = 'jsonb' then '''[]''::jsonb'
        when c.udt_name = 'json' then '''[]''::json'
        else '0'
      end
    ),
    ', '
    order by c.ordinal_position
  )
  into set_clause
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = any (array[
      'imported_total_tips',
      'imported_won_tips',
      'imported_lost_tips',
      'imported_void_tips',
      'imported_pending_tips',
      'imported_profit',
      'imported_yield',
      'imported_total_staked',
      'imported_avg_odds',
      'imported_highest_odds',
      'imported_tips_amount',
      'imported_monthly_stats',
      'imported_month_stats',
      'imported_hourly_stats',
      'imported_hour_stats',
      'imported_odds_range_stats',
      'imported_odds_stats',
      'imported_sport_stats',
      'imported_sports_stats',
      'imported_coupon_type_stats',
      'imported_coupon_stats',
      'imported_stats',
      'stats_imported_at',
      'imported_at',
      'total_tips',
      'tips_count',
      'won_tips',
      'wins',
      'lost_tips',
      'losses',
      'void_tips',
      'voids',
      'pending_tips',
      'total_staked',
      'profit',
      'yield',
      'roi',
      'avg_odds',
      'highest_odds',
      'active_days',
      'attendance_days',
      'activity_days',
      'ranking_percent'
    ]);

  if set_clause is not null then
    execute format(
      'update public.profiles p set %s where exists (select 1 from betai_v1804_reset_targets r where r.id = p.id)',
      set_clause
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_at'
  ) then
    update public.profiles p
    set updated_at = now()
    where exists (select 1 from betai_v1804_reset_targets r where r.id = p.id);
  end if;
end $$;

-- 6) Usuń wyłącznie osiągnięcia zależne od starych typów.
-- Pozostałe: polecenia, bonusy, monety, obserwujący i oceny zostają bez zmian.
do $$
begin
  if to_regclass('public.tipster_achievement_progress') is not null then
    delete from public.tipster_achievement_progress a
    where exists (
      select 1
      from betai_v1804_reset_targets r
      where coalesce(to_jsonb(a)->>'user_id', '') = r.id::text
    )
      and lower(coalesce(to_jsonb(a)->>'achievement_key', '')) in (
        'fanatyk',
        'prawdziwy-wygrany',
        'nieustraszony',
        'lojalny'
      );
  end if;
end $$;

-- 7) Jeżeli stare wersje utworzyły fizyczne tabele cache statystyk,
-- usuń z nich tylko rekord smilhytv. Zwykłe widoki nie wymagają czyszczenia.
do $$
declare
  cache_name text;
  relation_kind "char";
begin
  foreach cache_name in array array[
    'stats_overview',
    'stats_recent_form',
    'stats_by_league',
    'stats_by_type',
    'stats_distribution',
    'tipster_ranking',
    'tipster_ranking_live',
    'tipster_rankings'
  ]
  loop
    select c.relkind
    into relation_kind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = cache_name
    limit 1;

    if relation_kind in ('r', 'p') then
      execute format(
        $delete$
          delete from public.%I x
          where exists (
            select 1
            from betai_v1804_reset_targets r
            where coalesce(to_jsonb(x)->>'tipster_id', '') = r.id::text
               or coalesce(to_jsonb(x)->>'author_id', '') = r.id::text
               or coalesce(to_jsonb(x)->>'user_id', '') = r.id::text
               or lower(coalesce(to_jsonb(x)->>'email', '')) = 'smilhytv@gmail.com'
               or lower(coalesce(to_jsonb(x)->>'username', '')) = 'smilhytv'
               or lower(coalesce(to_jsonb(x)->>'author_name', '')) = 'smilhytv'
          )
        $delete$,
        cache_name
      );
    elsif relation_kind = 'm' then
      execute format('refresh materialized view public.%I', cache_name);
    end if;

    relation_kind := null;
  end loop;
end $$;

-- Wynik kontrolny przed COMMIT-em.
select
  (select count(*) from betai_v1804_reset_targets) as znalezione_profile,
  (select count(*) from betai_v1804_tip_ids) as usuniete_typy,
  (
    select count(*)
    from public.profiles p
    where exists (select 1 from betai_v1804_reset_targets r where r.id = p.id)
  ) as zresetowane_profile;

commit;

-- Po poprawnym wykonaniu wdroż paczkę v1804 na Netlify i odśwież stronę.
-- Frontend v1804 automatycznie usuwa stare cache typów/statystyk z localStorage/sessionStorage.
