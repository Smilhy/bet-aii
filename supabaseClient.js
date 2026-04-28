const Stripe = require('stripe');
const { getSupabase, forcePremiumUpdate, normalizeEmail } = require('./stripe-premium-utils');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function getCustomerEmail(customerId) {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return normalizeEmail(customer?.email || null);
  } catch (error) {
    console.warn('Could not retrieve Stripe customer:', error.message);
    return null;
  }
}

async function getSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.warn('Could not retrieve Stripe subscription:', error.message);
    return null;
  }
}

async function syncPremiumFromSession(supabase, session) {
  const subscription = session.subscription ? await getSubscription(session.subscription) : null;
  const customerEmail = normalizeEmail(
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.email ||
    (await getCustomerEmail(session.customer)) ||
    null
  );

  return forcePremiumUpdate(supabase, {
    userId: session.client_reference_id || session.metadata?.user_id || subscription?.metadata?.user_id || null,
    email: customerEmail,
    customerId: session.customer || null,
    subscriptionId: subscription?.id || session.subscription || null,
    status: subscription?.status || 'active',
    currentPeriodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
    forcePremium: true
  });
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
    return { ok: false, error: retry.error };
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
    return { ok: false, error: retry.error };
  }
  return { ok: false, error };
}

async function handleTipPurchase(supabase, session) {
  const userId = session.client_reference_id || session.metadata?.user_id || session.metadata?.buyer_id;
  const tipId = session.metadata?.tip_id;
  if (!userId || !tipId) throw new Error('tip_purchase missing user_id or tip_id');

  const amount = roundMoney(session.metadata?.amount_pln || (session.amount_total || 0) / 100);
  const platformFee = roundMoney(session.metadata?.platform_fee || amount * 0.20);
  const tipsterAmount = roundMoney(session.metadata?.tipster_amount || amount - platformFee);

  let tipsterId = session.metadata?.tipster_id || null;
  if (!tipsterId) {
    const { data: tipRow } = await supabase.from('tips').select('author_id').eq('id', tipId).maybeSingle();
    tipsterId = tipRow?.author_id || null;
  }

  await safeUpsert(
    supabase,
    'unlocked_tips',
    { user_id: userId, tip_id: tipId, price: amount, stripe_session_id: session.id },
    { onConflict: 'user_id,tip_id' },
    { user_id: userId, tip_id: tipId }
  );

  await safeInsert(
    supabase,
    'tip_purchases',
    {
      user_id: userId,
      tip_id: tipId,
      tipster_id: tipsterId,
      price: amount,
      platform_fee: platformFee,
      tipster_amount: tipsterAmount,
      stripe_session_id: session.id,
      status: 'paid'
    },
    { user_id: userId, tip_id: tipId, price: amount }
  );

  if (tipsterId && amount > 0) {
    await safeInsert(
      supabase,
      'earnings',
      {
        tipster_id: tipsterId,
        user_id: userId,
        tip_id: tipId,
        gross_amount: amount,
        amount: tipsterAmount,
        commission: platformFee,
        source: 'tip_purchase',
        stripe_session_id: session.id,
        status: 'available'
      },
      { tipster_id: tipsterId, amount: tipsterAmount, commission: platformFee, source: 'tip_purchase' }
    );
  }
}

async function handleTipsterProfileSubscription(supabase, session) {
  const userId = session.client_reference_id || session.metadata?.user_id || session.metadata?.buyer_id;
  const tipsterId = session.metadata?.tipster_id;
  if (!userId || !tipsterId) throw new Error('tipster_profile_subscription missing user_id or tipster_id');

  const durationDays = Number(session.metadata?.duration_days || 30);
  const amount = roundMoney(session.metadata?.amount_pln || (session.amount_total || 0) / 100);
  const platformFee = roundMoney(session.metadata?.platform_fee || amount * 0.20);
  const tipsterAmount = roundMoney(session.metadata?.tipster_amount || amount - platformFee);
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  await safeUpsert(
    supabase,
    'tipster_subscriptions',
    {
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
    },
    { onConflict: 'user_id,tipster_id' },
    { user_id: userId, buyer_id: userId, tipster_id: tipsterId, expires_at: expiresAt }
  );

  // Compatibility table name from earlier SQL discussions.
  await safeUpsert(
    supabase,
    'user_subscriptions',
    {
      user_id: userId,
      tipster_id: tipsterId,
      price: amount,
      expires_at: expiresAt,
      stripe_session_id: session.id,
      status: 'active'
    },
    { onConflict: 'user_id,tipster_id' },
    { user_id: userId, buyer_id: userId, tipster_id: tipsterId, expires_at: expiresAt }
  );

  if (amount > 0) {
    await safeInsert(
      supabase,
      'earnings',
      {
        tipster_id: tipsterId,
        user_id: userId,
        gross_amount: amount,
        amount: tipsterAmount,
        commission: platformFee,
        source: 'profile_subscription',
        stripe_session_id: session.id,
        status: 'available'
      },
      { tipster_id: tipsterId, amount: tipsterAmount, commission: platformFee, source: 'profile_subscription' }
    );
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const signature = event.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, secret);
  } catch (error) {
    console.error('Webhook signature error:', error.message);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  try {
    const supabase = getSupabase();

    if (stripeEvent.type === 'account.updated') {
      const account = stripeEvent.data.object;
      const userId = account.metadata?.user_id;
      if (userId) {
        const { error } = await supabase.from('user_stripe_accounts').upsert({
          user_id: userId,
          stripe_account_id: account.id,
          charges_enabled: Boolean(account.charges_enabled),
          payouts_enabled: Boolean(account.payouts_enabled),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) throw error;
      }
    }

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const kind = session.metadata?.kind;
      const userId = session.client_reference_id || session.metadata?.user_id;

      if (userId && kind === 'wallet_topup') {
        const amount = Number(session.metadata.amount || 0);
        if (amount > 0) {
          const { error } = await supabase.from('wallet_transactions').insert({
            user_id: userId,
            amount,
            type: 'topup',
            provider: 'stripe',
            provider_session_id: session.id,
            status: 'completed'
          });
          if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
        }
      }

      if (kind === 'tip_purchase') await handleTipPurchase(supabase, session);
      if (kind === 'tipster_profile_subscription') await handleTipsterProfileSubscription(supabase, session);

      const isPremiumCheckout =
        kind === 'premium_subscription' ||
        kind === 'premium_access' ||
        (session.mode === 'subscription' && kind !== 'tipster_profile_subscription') ||
        (Boolean(session.subscription) && kind !== 'tipster_profile_subscription');

      if (isPremiumCheckout) {
        const result = await syncPremiumFromSession(supabase, session);
        const amount = Number(session.metadata?.amount || 29);
        const { error: txError } = await supabase.from('wallet_transactions').insert({
          user_id: result.userId,
          amount,
          type: 'premium_purchase',
          provider: 'stripe',
          provider_session_id: session.id,
          status: 'completed'
        });
        if (txError && !String(txError.message || '').toLowerCase().includes('duplicate')) {
          console.warn('premium wallet transaction warning:', txError.message);
        }
      }
    }

    if (
      stripeEvent.type === 'customer.subscription.created' ||
      stripeEvent.type === 'customer.subscription.updated' ||
      stripeEvent.type === 'customer.subscription.deleted'
    ) {
      const subscription = stripeEvent.data.object;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      const customerEmail = await getCustomerEmail(customerId);
      const isDeleted = stripeEvent.type === 'customer.subscription.deleted' || subscription.status === 'canceled';

      await forcePremiumUpdate(supabase, {
        userId: subscription.metadata?.user_id || null,
        email: customerEmail,
        customerId,
        subscriptionId: subscription.id,
        status: isDeleted ? 'canceled' : (subscription.status || 'active'),
        currentPeriodEnd: subscription.current_period_end || null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        forcePremium: !isDeleted && ['active', 'trialing'].includes(subscription.status)
      });
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('stripe-webhook error:', error);
    return { statusCode: 500, body: error.message || 'Webhook handler error' };
  }
};
