const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

async function updatePremium(supabase, { userId, email, customerId, subscriptionId, status, currentPeriodEnd }) {
  let resolvedUserId = userId || null;
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

  if (!resolvedUserId && customerId) {
    const { data } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    resolvedUserId = data?.id || null;
  }
  if (!resolvedUserId && normalizedEmail) {
    const { data } = await supabase.from('profiles').select('id').ilike('email', normalizedEmail).maybeSingle();
    resolvedUserId = data?.id || null;
  }
  if (!resolvedUserId) throw new Error('Nie znaleziono usera dla tej sesji Stripe');

  const isActive = ['active', 'trialing', 'paid', 'complete'].includes(status || 'active');
  const periodEndIso = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;

  const profilePayload = {
    plan: isActive ? 'premium' : 'free',
    subscription_status: isActive ? 'active' : (status || 'inactive'),
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    current_period_end: periodEndIso
  };
  if (normalizedEmail) profilePayload.email = normalizedEmail;

  const { error: profileError } = await supabase.from('profiles').update(profilePayload).eq('id', resolvedUserId);
  if (profileError) throw profileError;

  const { error: subscriptionError } = await supabase.from('user_subscriptions').upsert({
    user_id: resolvedUserId,
    plan: profilePayload.plan,
    status: profilePayload.subscription_status,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    current_period_end: periodEndIso,
    cancel_at_period_end: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  if (subscriptionError) {
    console.warn('user_subscriptions sync warning:', subscriptionError.message);
  }

  return { userId: resolvedUserId, plan: profilePayload.plan, status: profilePayload.subscription_status };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { session_id } = JSON.parse(event.body || '{}');
    if (!session_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });

    const subscription = session.subscription && typeof session.subscription !== 'string' ? session.subscription : null;
    const customer = session.customer && typeof session.customer !== 'string' ? session.customer : null;

    if (session.mode !== 'subscription' && !subscription) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Not a subscription checkout session' }) };
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete' && subscription?.status !== 'active') {
      return { statusCode: 402, body: JSON.stringify({ error: 'Session is not paid/complete yet', payment_status: session.payment_status, status: session.status }) };
    }

    const result = await updatePremium(getSupabase(), {
      userId: session.client_reference_id || session.metadata?.user_id || subscription?.metadata?.user_id || null,
      email: session.customer_details?.email || session.customer_email || customer?.email || session.metadata?.email || null,
      customerId: customer?.id || session.customer || null,
      subscriptionId: subscription?.id || session.subscription || null,
      status: subscription?.status || session.status || 'active',
      currentPeriodEnd: subscription?.current_period_end || null
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (error) {
    console.error('sync-premium-session error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Premium sync error' }) };
  }
};
