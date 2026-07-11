-- WERSJA 1900 — synchronizacja osiągnięć z prawdziwymi statystykami profilu.
-- Naprawia rozjazd typu: profil 848 typów / 492 wygrane,
-- a odznaki nadal 812 / 474 (stara baza importu).
-- Uruchom raz w Supabase SQL Editor.

create or replace function public.refresh_tipster_achievements_v1774(p_user_id uuid)
returns setof public.tipster_achievement_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_profile_json jsonb;
  v_email text := '';
  v_username text := '';
  v_username_key text := '';

  v_tip_count_all integer := 0;
  v_won_count_all integer := 0;
  v_tip_count_live integer := 0;
  v_won_count_live integer := 0;
  v_high_odds_count integer := 0;
  v_active_days integer := 0;
  v_referrals integer := 0;
  v_bonus_claims integer := 0;
  v_wallet_balance numeric := 0;
  v_lifetime_coins numeric := 0;
  v_followers integer := 0;
  v_ratings_given integer := 0;

  v_additive boolean := false;
  v_imported_at timestamptz;
  v_imported_total integer := 0;
  v_imported_wins integer := 0;
  v_imported_active_days integer := 0;

  v_total_tips integer := 0;
  v_total_wins integer := 0;
  v_coins numeric := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  limit 1;

  if not found then
    return;
  end if;

  v_profile_json := to_jsonb(v_profile);
  v_email := lower(trim(coalesce(v_profile.email, '')));
  v_username := trim(coalesce(v_profile.username, ''));
  v_username_key := public.betai_achievement_identity_key_v1774(v_username);

  v_additive := coalesce(nullif(v_profile_json->>'imported_stats_additive', '')::boolean, false)
    or lower(coalesce(v_profile_json->>'imported_stats_mode', '')) = 'baseline';
  v_imported_at := nullif(v_profile_json->>'stats_imported_at', '')::timestamptz;
  v_imported_total := greatest(0, coalesce(nullif(v_profile_json->>'imported_total_tips', '')::integer, 0));
  v_imported_wins := greatest(0, coalesce(nullif(v_profile_json->>'imported_won_tips', '')::integer, 0));
  v_imported_active_days := greatest(
    0,
    coalesce(nullif(v_profile_json->>'active_days', '')::integer, 0),
    coalesce(nullif(v_profile_json->>'attendance_days', '')::integer, 0),
    coalesce(nullif(v_profile_json->>'activity_days', '')::integer, 0),
    coalesce(nullif(v_profile_json->>'imported_active_days', '')::integer, 0)
  );

  select
    count(*)::integer,
    count(*) filter (
      where lower(concat_ws(
        ' ',
        coalesce(t.status, ''),
        coalesce(t.result, ''),
        coalesce(t.result_status, ''),
        coalesce(t.settlement_status, '')
      )) ~ '(won|win|wygran)'
    )::integer,
    count(*) filter (
      where v_imported_at is not null and t.created_at > v_imported_at
    )::integer,
    count(*) filter (
      where v_imported_at is not null
        and t.created_at > v_imported_at
        and lower(concat_ws(
          ' ',
          coalesce(t.status, ''),
          coalesce(t.result, ''),
          coalesce(t.result_status, ''),
          coalesce(t.settlement_status, '')
        )) ~ '(won|win|wygran)'
    )::integer,
    count(*) filter (where coalesce(t.odds, 0) > 3.00)::integer,
    count(distinct ((t.created_at at time zone 'UTC')::date))::integer
  into
    v_tip_count_all,
    v_won_count_all,
    v_tip_count_live,
    v_won_count_live,
    v_high_odds_count,
    v_active_days
  from public.tips t
  where
    t.author_id = p_user_id
    or t.user_id = p_user_id
    or (v_email <> '' and lower(trim(coalesce(t.author_email, ''))) = v_email)
    or (
      v_username_key <> ''
      and (
        public.betai_achievement_identity_key_v1774(t.username) = v_username_key
        or public.betai_achievement_identity_key_v1774(t.author_name) = v_username_key
      )
    );

  if v_additive and v_imported_at is not null then
    v_total_tips := v_imported_total + v_tip_count_live;
    v_total_wins := v_imported_wins + v_won_count_live;
  else
    v_total_tips := greatest(v_tip_count_all, v_imported_total);
    v_total_wins := greatest(v_won_count_all, v_imported_wins);
  end if;

  -- Gdy stara platforma nie przechowywała liczby aktywnych dni,
  -- stosujemy ten sam konserwatywny fallback co profil: maksymalnie 90 dni.
  if v_additive and v_imported_total > 0 and v_imported_active_days = 0 then
    v_imported_active_days := least(90, v_imported_total);
  end if;
  v_active_days := greatest(v_active_days, v_imported_active_days);

  select count(*)::integer into v_referrals
  from public.referrals r
  where r.referrer_id = p_user_id;
  v_referrals := greatest(v_referrals, coalesce(nullif(v_profile_json->>'referrals_count', '')::integer, 0));

  select count(*)::integer into v_bonus_claims
  from public.community_reward_claims c
  where c.claimed is distinct from false
    and (
      c.user_id = p_user_id
      or (v_email <> '' and lower(trim(coalesce(c.email, ''))) = v_email)
    );

  select coalesce(max(w.balance), 0) into v_wallet_balance
  from public.betai_token_wallets w
  where w.user_id = p_user_id
     or (v_email <> '' and lower(trim(coalesce(w.email, ''))) = v_email);

  select coalesce(sum(greatest(tx.delta_tokens, 0)), 0) into v_lifetime_coins
  from public.betai_token_transactions tx
  where tx.user_id = p_user_id
     or (v_email <> '' and lower(trim(coalesce(tx.email, ''))) = v_email);
  v_coins := greatest(
    v_wallet_balance,
    v_lifetime_coins,
    coalesce(nullif(v_profile_json->>'coins', '')::numeric, 0),
    coalesce(nullif(v_profile_json->>'coin_balance', '')::numeric, 0)
  );

  select count(*)::integer into v_followers
  from public.tipster_follows f
  where f.tipster_id = p_user_id;
  v_followers := greatest(v_followers, coalesce(nullif(v_profile_json->>'followers_count', '')::integer, 0));

  select count(distinct pr.profile_id)::integer into v_ratings_given
  from public.profile_reviews pr
  where pr.is_approved is distinct from false
    and (
      pr.reviewer_id = p_user_id
      or (v_email <> '' and lower(trim(coalesce(pr.reviewer_email, ''))) = v_email)
    );

  insert into public.tipster_achievement_progress (
    user_id, achievement_key, current_value, target_value,
    unlocked, unlocked_at, sort_order, updated_at
  )
  select
    p_user_id,
    x.achievement_key,
    greatest(x.current_value, 0),
    x.target_value,
    x.current_value >= x.target_value,
    case when x.current_value >= x.target_value then now() else null end,
    x.sort_order,
    now()
  from (
    values
      ('fanatyk',             v_total_tips::numeric,      1000::numeric, 1::smallint),
      ('prawdziwy-wygrany',   v_total_wins::numeric,       500::numeric, 2::smallint),
      ('nieustraszony',       v_high_odds_count::numeric,  100::numeric, 3::smallint),
      ('lojalny',             v_active_days::numeric,      180::numeric, 4::smallint),
      ('czlonek-rodziny',     v_referrals::numeric,         10::numeric, 5::smallint),
      ('lowca-bonusow',       v_bonus_claims::numeric,     100::numeric, 6::smallint),
      ('bogaty',              v_coins::numeric,          10000::numeric, 7::smallint),
      ('slawny',              v_followers::numeric,        500::numeric, 8::smallint),
      ('krytyk-bukmacherski', v_ratings_given::numeric,     50::numeric, 9::smallint)
  ) as x(achievement_key, current_value, target_value, sort_order)
  on conflict (user_id, achievement_key)
  do update set
    current_value = greatest(
      public.tipster_achievement_progress.current_value,
      excluded.current_value
    ),
    target_value = excluded.target_value,
    unlocked = public.tipster_achievement_progress.unlocked or excluded.unlocked,
    unlocked_at = coalesce(
      public.tipster_achievement_progress.unlocked_at,
      excluded.unlocked_at
    ),
    sort_order = excluded.sort_order,
    updated_at = now();

  return query
  select p.*
  from public.tipster_achievement_progress p
  where p.user_id = p_user_id
  order by p.sort_order;
end;
$$;

grant execute on function public.refresh_tipster_achievements_v1774(uuid)
to anon, authenticated, service_role;

-- Jednorazowo prostujemy istniejące rekordy wszystkich profili.
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_tipster_achievements_v1774(r.id);
  end loop;
end;
$$;
