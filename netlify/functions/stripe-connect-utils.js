const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function safeInsert(supabase, table, payload, fallbackPayload = null) {
  const { error } = await supabase.from(table).insert(payload);
  if (!error) return { ok: true };
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('duplicate')) return { ok: true, duplicate: true };
  console.warn(`${table} insert warning:`, error.message);
  if (fallbackPayload) {
    const retry = await supabase.from(table).insert(fallbackPayload);
    if (!retry.error || String(retry.error.message || '').toLowerCase().includes('duplicate')) return { ok: true, fallback: true };
    console.warn(`${table} fallback warning:`, retry.error.message);
  }
  return { ok: false, error };
}

async function safeUpsert(supabase, table, payload, options, fallbackPayload = null) {
  const { error } = await supabase.from(table).upsert(payload, options || {});
  if (!error) return { ok: true };
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('duplicate')) return { ok: true, duplicate: true };
  console.warn(`${table} upsert warning:`, error.message);
  if (fallbackPayload) {
    const retry = await supabase.from(table).upsert(fallbackPayload, options || {});
    if (!retry.error || String(retry.error.message || '').toLowerCase().includes('duplicate')) return { ok: true, fallback: true };
    console.warn(`${table} fallback warning:`, retry.error.message);
  }
  return { ok: false, error };
}

async function notifyUser(supabase, userId, title, body) {
  if (!userId) return;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    const email = profile?.email;
    if (!email) return;

    // V6: prevent repeated Stripe Connect notification spam during webhook retries/reconnects.
    const { data: existing } = await supabase
      .from('betai_system_notifications')
      .select('id')
      .eq('recipient_email', String(email).toLowerCase())
      .eq('title', title)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    if (Array.isArray(existing) && existing.length) return;

    await safeInsert(supabase, 'betai_system_notifications', {
      recipient_email: String(email).toLowerCase(),
      title,
      body,
      message: body,
      reward_tokens: 0,
      sent_by: 'betai',
      is_read: false
    });
  } catch (error) {
    console.warn('notifyUser skipped:', error.message);
  }
}

async function updateConnectedAccountFromStripeAccount(supabase, account) {
  const userId = account?.metadata?.user_id;
  const accountId = account?.id;
  if (!userId || !accountId) return { ok: false, reason: 'missing metadata.user_id or account.id' };

  const payload = {
    user_id: userId,
    stripe_account_id: accountId,
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    details_submitted: Boolean(account.details_submitted),
    connect_status: account.payouts_enabled ? 'connected' : (account.details_submitted ? 'pending' : 'onboarding'),
    updated_at: new Date().toISOString()
  };

  const result = await safeUpsert(supabase, 'user_stripe_accounts', payload, { onConflict: 'user_id' });
  if (account.payouts_enabled) {
    await notifyUser(supabase, userId, 'Stripe Connect podłączony', 'Twoje konto Stripe jest aktywne. Możesz sprzedawać typy i subskrypcje profilu.');
  }
  return result;
}

async function recordReferralReward(supabase, { userId, amount, source, sourceId, sessionId }) {
  if (!userId || !amount || amount <= 0) return;
  try {
    const { error } = await supabase.rpc('record_referral_reward', {
      p_referred_user_id: userId,
      p_gross_amount: amount,
      p_source: source || 'purchase',
      p_source_id: sourceId || null,
      p_stripe_session_id: sessionId || null
    });
    if (error) console.warn('referral reward warning:', error.message);
  } catch (error) {
    console.warn('referral reward exception:', error.message);
  }
}

async function handleTipPurchase(supabase, session) {
  const userId = session.client_reference_id || session.metadata?.user_id || session.metadata?.buyer_id;
  const tipId = session.metadata?.tip_id;
  if (!userId || !tipId) throw new Error('tip_purchase missing user_id or tip_id');

  const amount = roundMoney(session.metadata?.amount_pln || (session.amount_total || 0) / 100);
  const platformFee = roundMoney(session.metadata?.platform_fee || amount * 0.20);
  const tipsterAmount = roundMoney(session.metadata?.tipster_amount || amount - platformFee);
  const tipsterId = session.metadata?.tipster_id || null;

  await safeUpsert(
    supabase,
    'unlocked_tips',
    { user_id: userId, tip_id: tipId, price: amount, stripe_session_id: session.id },
    { onConflict: 'user_id,tip_id' },
    { user_id: userId, tip_id: tipId }
  );

  await safeInsert(supabase, 'payments', {
    user_id: userId,
    tip_id: tipId,
    stripe_session_id: session.id,
    amount,
    currency: String(session.currency || 'pln').toLowerCase(),
    status: 'paid',
    provider: 'stripe_connect_tip'
  }, { user_id: userId, tip_id: tipId, amount, status: 'paid' });

  await safeInsert(supabase, 'tip_purchases', {
    user_id: userId,
    tip_id: tipId,
    tipster_id: tipsterId,
    price: amount,
    platform_fee: platformFee,
    tipster_amount: tipsterAmount,
    stripe_session_id: session.id,
    status: 'paid'
  }, { user_id: userId, tip_id: tipId, price: amount });

  if (tipsterId && amount > 0) {
    await safeInsert(supabase, 'earnings', {
      tipster_id: tipsterId,
      user_id: userId,
      tip_id: tipId,
      gross_amount: amount,
      amount: tipsterAmount,
      commission: platformFee,
      source: 'tip_purchase',
      stripe_session_id: session.id,
      status: 'available'
    }, { tipster_id: tipsterId, amount: tipsterAmount, commission: platformFee, source: 'tip_purchase' });
  }

  await safeInsert(supabase, 'wallet_transactions', {
    user_id: userId,
    amount: -amount,
    type: 'tip_purchase',
    provider: 'stripe_connect',
    provider_session_id: session.id,
    status: 'completed'
  });

  await recordReferralReward(supabase, { userId, amount, source: 'tip_purchase', sourceId: tipId, sessionId: session.id });
  return { ok: true, kind: 'tip_purchase', userId, tipId };
}

async function handleTipsterProfileSubscription(supabase, session) {
  const userId = session.client_reference_id || session.metadata?.user_id || session.metadata?.buyer_id;
  const tipsterId = session.metadata?.tipster_id;
  if (!userId || !tipsterId) throw new Error('tipster_profile_subscription missing user_id or tipster_id');

  const durationDays = Number(session.metadata?.duration_days || 30);
  const amount = roundMoney(session.metadata?.amount_pln || (session.amount_total || 0) / 100);
  const platformFee = roundMoney(session.metadata?.platform_fee || amount * 0.20);
  const tipsterAmount = roundMoney(session.metadata?.tipster_amount || amount - platformFee);
  const existingUntil = new Date();
  const expiresAt = new Date(existingUntil.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  await safeUpsert(supabase, 'tipster_subscriptions', {
    user_id: userId,
    buyer_id: userId,
    tipster_id: tipsterId,
    duration_days: durationDays,
    price: amount,
    platform_fee: platformFee,
    tipster_amount: tipsterAmount,
    stripe_session_id: session.id,
    status: 'active',
    expires_at: expiresAt
  }, { onConflict: 'user_id,tipster_id' }, { user_id: userId, buyer_id: userId, tipster_id: tipsterId, expires_at: expiresAt });

  await safeInsert(supabase, 'payments', {
    user_id: userId,
    tip_id: null,
    stripe_session_id: session.id,
    amount,
    currency: String(session.currency || 'pln').toLowerCase(),
    status: 'paid',
    provider: 'stripe_connect_profile_subscription'
  }, { user_id: userId, amount, status: 'paid' });

  if (amount > 0) {
    await safeInsert(supabase, 'earnings', {
      tipster_id: tipsterId,
      user_id: userId,
      gross_amount: amount,
      amount: tipsterAmount,
      commission: platformFee,
      source: 'profile_subscription',
      stripe_session_id: session.id,
      status: 'available'
    }, { tipster_id: tipsterId, amount: tipsterAmount, commission: platformFee, source: 'profile_subscription' });
  }

  await safeInsert(supabase, 'wallet_transactions', {
    user_id: userId,
    amount: -amount,
    type: 'profile_subscription',
    provider: 'stripe_connect',
    provider_session_id: session.id,
    status: 'completed'
  });

  await recordReferralReward(supabase, { userId, amount, source: 'profile_subscription', sourceId: tipsterId, sessionId: session.id });
  return { ok: true, kind: 'tipster_profile_subscription', userId, tipsterId, expiresAt };
}

async function handleConnectCheckoutSession(supabase, session) {
  const kind = session?.metadata?.kind;
  if (kind === 'tip_purchase') return handleTipPurchase(supabase, session);
  if (kind === 'tipster_profile_subscription') return handleTipsterProfileSubscription(supabase, session);
  return { ok: true, ignored: true, kind: kind || null };
}

module.exports = {
  getSupabase,
  roundMoney,
  updateConnectedAccountFromStripeAccount,
  handleConnectCheckoutSession
};
