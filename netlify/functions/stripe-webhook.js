const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

async function resolveUserId(supabase, { userId, customerId, email }) {
  if (userId) return userId;

  if (customerId) {
    const { data: profileByCustomer } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (profileByCustomer?.id) return profileByCustomer.id;

    const { data: subscriptionByCustomer } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (subscriptionByCustomer?.user_id) return subscriptionByCustomer.user_id;
  }

  if (email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();
    if (profileByEmail?.id) return profileByEmail.id;
  }

  return null;
}

async function updatePremiumStatus(supabase, payload) {
  const {
    userId,
    customerId,
    subscriptionId,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    email
  } = payload;

  const resolvedUserId = await resolveUserId(supabase, { userId, customerId, email });
  if (!resolvedUserId) {
    console.warn('Premium webhook: user not resolved', { userId, customerId, email, subscriptionId, status });
    return { resolved: false };
  }

  const isActive = ['active', 'trialing'].includes(status);
  const plan = isActive ? 'premium' : 'free';
  const periodEndIso = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;

  const updatePayload = {
    plan,
    subscription_status: status || 'inactive',
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    current_period_end: periodEndIso
  };

  if (email) updatePayload.email = String(email).trim().toLowerCase();

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', resolvedUserId);

  if (profileError) throw profileError;

  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: resolvedUserId,
      plan,
      status: status || 'inactive',
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      current_period_end: periodEndIso,
      cancel_at_period_end: Boolean(cancelAtPeriodEnd),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (subscriptionError) throw subscriptionError;
  return { resolved: true, userId: resolvedUserId, plan, status };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

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
      const userId = session.metadata?.user_id || session.client_reference_id;

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

      const isPremiumCheckout =
        kind === 'premium_subscription' ||
        kind === 'premium_access' ||
        session.mode === 'subscription' ||
        Boolean(session.subscription);

      if (isPremiumCheckout) {
        let subscription = null;
        if (session.subscription) {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }

        const customerEmail =
          session.customer_details?.email ||
          session.customer_email ||
          session.metadata?.email ||
          null;

        const result = await updatePremiumStatus(supabase, {
          userId,
          customerId: session.customer,
          subscriptionId: session.subscription || null,
          status: subscription?.status || 'active',
          currentPeriodEnd: subscription?.current_period_end || null,
          cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
          email: customerEmail
        });

        if (result?.resolved) {
          const amount = Number(session.metadata?.amount || 29);
          const { error: txError } = await supabase.from('wallet_transactions').insert({
            user_id: result.userId,
            amount,
            type: 'premium_purchase',
            provider: 'stripe',
            provider_session_id: session.id,
            status: 'completed'
          });
          if (txError && !String(txError.message || '').toLowerCase().includes('duplicate')) throw txError;
        }
      }
    }

    if (
      stripeEvent.type === 'customer.subscription.created' ||
      stripeEvent.type === 'customer.subscription.updated' ||
      stripeEvent.type === 'customer.subscription.deleted'
    ) {
      const subscription = stripeEvent.data.object;
      let customerEmail = null;
      if (subscription.customer) {
        try {
          const customer = await stripe.customers.retrieve(subscription.customer);
          customerEmail = customer?.email || null;
        } catch (customerError) {
          console.warn('Could not retrieve Stripe customer email:', customerError.message);
        }
      }

      await updatePremiumStatus(supabase, {
        userId: subscription.metadata?.user_id || null,
        customerId: subscription.customer,
        subscriptionId: subscription.id,
        status: subscription.status === 'canceled' ? 'canceled' : subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        email: customerEmail
      });
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('stripe-webhook error:', error);
    return { statusCode: 500, body: error.message || 'Webhook handler error' };
  }
};
