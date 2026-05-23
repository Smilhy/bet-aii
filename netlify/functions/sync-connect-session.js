const Stripe = require('stripe');
const { getSupabase, handleConnectCheckoutSession } = require('./stripe-connect-utils');

const stripe = new Stripe(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    if (!(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
      throw new Error('Missing STRIPE_CONNECT_SECRET_KEY');
    }
    const { session_id, expected_user_id } = JSON.parse(event.body || '{}');
    if (!session_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const sessionUserId = session.client_reference_id || session.metadata?.user_id || session.metadata?.buyer_id;
    const userMismatch = Boolean(expected_user_id && sessionUserId && String(expected_user_id) !== String(sessionUserId));

    if (!(session.payment_status === 'paid' || session.status === 'complete')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'SESSION_NOT_PAID' }) };
    }

    const supabase = getSupabase();
    const result = await handleConnectCheckoutSession(supabase, session);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, user_mismatch: userMismatch, session_user_id: sessionUserId || null, expected_user_id: expected_user_id || null })
    };
  } catch (error) {
    console.error('sync-connect-session error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message || 'Connect session sync error' }) };
  }
};
