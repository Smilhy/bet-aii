-- BET+AI — WERSJA 1775
-- Zmiana celu osiągnięcia „Krytyk Bukmacherski” z 1 na 50 ocen profili typerów.

begin;

-- Aktualizacja istniejących rekordów postępu.
update public.tipster_achievement_progress
set
  target_value = 50,
  unlocked = case
    when current_value >= 50 then true
    else false
  end,
  unlocked_at = case
    when current_value >= 50 then coalesce(unlocked_at, now())
    else null
  end,
  updated_at = now()
where achievement_key = 'krytyk-bukmacherski';

-- Podmiana głównej funkcji przeliczającej tylko w części dotyczącej tego celu.
create or replace function public.refresh_tipster_achievements_v1774(p_user_id uuid)
returns setof public.tipster_achievement_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text := '';
  v_username text := '';
  v_username_key text := '';

  v_tip_count integer := 0;
  v_won_count integer := 0;
  v_high_odds_count integer := 0;
  v_active_days integer := 0;
  v_referrals integer := 0;
  v_bonus_claims integer := 0;
  v_wallet_balance numeric := 0;
  v_lifetime_coins numeric := 0;
  v_followers integer := 0;
  v_ratings_given integer := 0;

  v_total_tips integer := 0;
  v_total_wins integer := 0;
  v_coins numeric := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  limit 1;

  if not found then
    return;
  end if;

  v_email := lower(trim(coalesce(v_profile.email, '')));
  v_username := trim(coalesce(v_profile.username, ''));
  v_username_key := public.betai_achievement_identity_key_v1774(v_username);

  select
    count(*)::integer,
    (
      count(*) filter (
        where lower(
          concat_ws(
            ' ',
            coalesce(t.status, ''),
            coalesce(t.result, ''),
            coalesce(t.result_status, ''),
            coalesce(t.settlement_status, '')
          )
        ) ~ '(won|win|wygran)'
      )
    )::integer,
    (
      count(*) filter (
        where coalesce(t.odds, 0) > 3.00
      )
    )::integer,
    count(distinct ((t.created_at at time zone 'UTC')::date))::integer
  into
    v_tip_count,
    v_won_count,
    v_high_odds_count,
    v_active_days
  from public.tips t
  where
    t.author_id = p_user_id
    or t.user_id = p_user_id
    or (
      v_email <> ''
      and lower(trim(coalesce(t.author_email, ''))) = v_email
    )
    or (
      v_username_key <> ''
      and (
        public.betai_achievement_identity_key_v1774(t.username) = v_username_key
        or public.betai_achievement_identity_key_v1774(t.author_name) = v_username_key
      )
    );

  v_total_tips := greatest(
    v_tip_count,
    coalesce(v_profile.imported_total_tips, 0)
  );

  v_total_wins := greatest(
    v_won_count,
    coalesce(v_profile.imported_won_tips, 0)
  );

  select count(*)::integer
  into v_referrals
  from public.referrals r
  where r.referrer_id = p_user_id;

  v_referrals := greatest(
    v_referrals,
    coalesce(v_profile.referrals_count, 0)
  );

  select count(*)::integer
  into v_bonus_claims
  from public.community_reward_claims c
  where c.claimed is distinct from false
    and (
      c.user_id = p_user_id
      or (
        v_email <> ''
        and lower(trim(coalesce(c.email, ''))) = v_email
      )
    );

  select coalesce(max(w.balance), 0)
  into v_wallet_balance
  from public.betai_token_wallets w
  where
    w.user_id = p_user_id
    or (
      v_email <> ''
      and lower(trim(coalesce(w.email, ''))) = v_email
    );

  select coalesce(
    sum(greatest(tx.delta_tokens, 0)),
    0
  )
  into v_lifetime_coins
  from public.betai_token_transactions tx
  where
    tx.user_id = p_user_id
    or (
      v_email <> ''
      and lower(trim(coalesce(tx.email, ''))) = v_email
    );

  v_coins := greatest(
    v_wallet_balance,
    v_lifetime_coins
  );

  select count(*)::integer
  into v_followers
  from public.tipster_follows f
  where f.tipster_id = p_user_id;

  v_followers := greatest(
    v_followers,
    coalesce(v_profile.followers_count, 0)
  );

  select count(distinct pr.profile_id)::integer
  into v_ratings_given
  from public.profile_reviews pr
  where pr.is_approved is distinct from false
    and (
      pr.reviewer_id = p_user_id
      or (
        v_email <> ''
        and lower(trim(coalesce(pr.reviewer_email, ''))) = v_email
      )
    );

  insert into public.tipster_achievement_progress (
    user_id,
    achievement_key,
    current_value,
    target_value,
    unlocked,
    unlocked_at,
    sort_order,
    updated_at
  )
  select
    p_user_id,
    values_row.achievement_key,
    greatest(values_row.current_value, 0),
    values_row.target_value,
    values_row.current_value >= values_row.target_value,
    case
      when values_row.current_value >= values_row.target_value then now()
      else null
    end,
    values_row.sort_order,
    now()
  from (
    values
      ('fanatyk',             v_total_tips::numeric,      1000::numeric, 1::smallint),
      ('prawdziwy-wygrany',   v_total_wins::numeric,       500::numeric, 2::smallint),
      ('nieustraszony',       v_high_odds_count::numeric,   100::numeric, 3::smallint),
      ('lojalny',             v_active_days::numeric,       180::numeric, 4::smallint),
      ('czlonek-rodziny',     v_referrals::numeric,          10::numeric, 5::smallint),
      ('lowca-bonusow',       v_bonus_claims::numeric,      100::numeric, 6::smallint),
      ('bogaty',              v_coins::numeric,           10000::numeric, 7::smallint),
      ('slawny',              v_followers::numeric,         500::numeric, 8::smallint),
      ('krytyk-bukmacherski', v_ratings_given::numeric,      50::numeric, 9::smallint)
  ) as values_row(
    achievement_key,
    current_value,
    target_value,
    sort_order
  )
  on conflict (user_id, achievement_key)
  do update set
    current_value = excluded.current_value,
    target_value = excluded.target_value,
    unlocked =
      public.tipster_achievement_progress.unlocked
      or excluded.unlocked,
    unlocked_at = coalesce(
      public.tipster_achievement_progress.unlocked_at,
      excluded.unlocked_at
    ),
    sort_order = excluded.sort_order,
    updated_at = now();

  return query
  select progress.*
  from public.tipster_achievement_progress progress
  where progress.user_id = p_user_id
  order by progress.sort_order;
end;
$$;

-- Przeliczenie wszystkich profili.
do $$
declare
  profile_row record;
begin
  for profile_row in
    select id
    from public.profiles
  loop
    perform public.refresh_tipster_achievements_v1774(profile_row.id);
  end loop;
end;
$$;

commit;

select
  p.username,
  a.current_value,
  a.target_value,
  a.unlocked,
  a.unlocked_at
from public.tipster_achievement_progress a
join public.profiles p on p.id = a.user_id
where a.achievement_key = 'krytyk-bukmacherski'
order by p.username;
