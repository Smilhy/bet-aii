-- BETAI SQL 822 — kupno i wymiana żetonów
-- 1000 żetonów = 1 zł wartości nominalnej
-- Kupno: 1000 żetonów za 1.10 zł
-- Wymiana na walutę: 1000 żetonów za 0.90 zł

CREATE OR REPLACE FUNCTION public.buy_wallet_tokens(p_packs integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_packs integer := greatest(1, coalesce(p_packs, 1));
  v_tokens integer := v_packs * 1000;
  v_cost numeric := round(v_packs * 1.10, 2);
  v_wallet_balance numeric := 0;
  v_token_balance integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'EMAIL_NOT_FOUND'; END IF;
  SELECT public.get_wallet_balance(v_user_id) INTO v_wallet_balance;
  IF coalesce(v_wallet_balance, 0) < v_cost THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  INSERT INTO public.betai_token_wallets(email, user_id, balance, welcome_bonus_claimed, updated_at)
  VALUES (v_email, v_user_id, v_tokens, true, now())
  ON CONFLICT (email) DO UPDATE SET user_id = excluded.user_id, balance = public.betai_token_wallets.balance + excluded.balance, updated_at = now();

  SELECT balance INTO v_token_balance FROM public.betai_token_wallets WHERE email = v_email;
  INSERT INTO public.wallet_transactions(user_id, amount, type, provider, provider_session_id, status)
  VALUES (v_user_id, v_cost, 'spend', 'token_exchange', 'token_buy_' || gen_random_uuid()::text, 'completed');
  INSERT INTO public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_data)
  VALUES (v_email, v_tokens, -v_cost, 'token_purchase', 'wallet_exchange', jsonb_build_object('packs', v_packs, 'rate_pln_per_1000', 1.10));

  RETURN jsonb_build_object('tokens', v_tokens, 'cost', v_cost, 'token_balance', v_token_balance, 'wallet_balance', public.get_wallet_balance(v_user_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.sell_wallet_tokens(p_packs integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_packs integer := greatest(1, coalesce(p_packs, 1));
  v_tokens integer := v_packs * 1000;
  v_pln numeric := round(v_packs * 0.90, 2);
  v_token_balance integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'EMAIL_NOT_FOUND'; END IF;

  SELECT balance INTO v_token_balance FROM public.betai_token_wallets WHERE email = v_email FOR UPDATE;
  IF coalesce(v_token_balance, 0) < v_tokens THEN RAISE EXCEPTION 'INSUFFICIENT_TOKENS'; END IF;

  UPDATE public.betai_token_wallets SET balance = balance - v_tokens, user_id = coalesce(user_id, v_user_id), updated_at = now() WHERE email = v_email;
  INSERT INTO public.betai_token_transactions(email, delta_tokens, delta_pln, reason, ref_type, ref_data)
  VALUES (v_email, -v_tokens, v_pln, 'token_exchange_to_wallet', 'wallet_exchange', jsonb_build_object('packs', v_packs, 'rate_pln_per_1000', 0.90));
  INSERT INTO public.wallet_transactions(user_id, amount, type, provider, provider_session_id, status)
  VALUES (v_user_id, v_pln, 'token_exchange', 'token_exchange', 'token_sell_' || gen_random_uuid()::text, 'completed');

  SELECT balance INTO v_token_balance FROM public.betai_token_wallets WHERE email = v_email;
  RETURN jsonb_build_object('tokens', v_tokens, 'pln', v_pln, 'token_balance', v_token_balance, 'wallet_balance', public.get_wallet_balance(v_user_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_wallet_tokens(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_wallet_tokens(integer) TO authenticated;
