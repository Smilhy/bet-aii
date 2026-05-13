const Stripe = require('stripe');
const { getSupabase, forcePremiumUpdate, normalizeEmail } = require('./stripe-premium-utils');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getActiveSubscription(subscriptions = []) {
  return subscriptions.find((sub) => ['active', 'trialing'].includes(sub.status)) || subscriptions[0] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { session_id, expected_user_id, expected_email } = body;

    if (!session_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });

    const expandedSubscription = session.subscription && typeof session.subscription !== 'string' ? session.subscription : null;
    const expandedCustomer = session.customer && typeof session.customer !== 'string' ? session.customer : null;
    const customerId = expandedCustomer?.id || (typeof session.customer === 'string' ? session.customer : null);

    let subscription = expandedSubscription;

    // Hard fallback: if Checkout does not expand subscription yet, read current active customer subscription.
    if (!subscription && customerId) {
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      subscription = getActiveSubscription(list.data);
    }

    const isPaidOrActive =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      ['active', 'trialing'].includes(subscription?.status);

    if (session.mode !== 'subscription' && !subscription) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Not a subscription checkout session' }) };
    }

    if (!isPaidOrActive) {
      return {
        statusCode: 402,
        body: JSON.stringify({
          error: 'Session is not paid/complete yet',
          payment_status: session.payment_status,
          status: session.status,
          subscription_status: subscription?.status || null
        })
      };
    }

    const email = normalizeEmail(
      session.customer_details?.email ||
      session.customer_email ||
      expandedCustomer?.email ||
      session.metadata?.email ||
      expected_email ||
      null
    );

    const result = await forcePremiumUpdate(getSupabase(), {
      userId: session.client_reference_id || session.metadata?.user_id || subscription?.metadata?.user_id || null,
      expectedUserId: expected_user_id || null,
      email,
      expectedEmail: expected_email || null,
      customerId,
      subscriptionId: subscription?.id || (typeof session.subscription === 'string' ? session.subscription : null),
      status: subscription?.status || 'active',
      currentPeriodEnd: subscription?.current_period_end || null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
      forcePremium: true
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (error) {
    console.error('sync-premium-session error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Premium sync error' }) };
  }
};
