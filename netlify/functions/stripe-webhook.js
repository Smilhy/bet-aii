const Stripe = require('stripe');
const { getSupabase, forcePremiumUpdate, normalizeEmail } = require('./stripe-premium-utils');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

      const isPremiumCheckout =
        kind === 'premium_subscription' ||
        kind === 'premium_access' ||
        session.mode === 'subscription' ||
        Boolean(session.subscription);

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
