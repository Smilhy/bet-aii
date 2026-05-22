const Stripe = require('stripe');
const {
  getSupabase,
  updateConnectedAccountFromStripeAccount,
  handleConnectCheckoutSession
} = require('./stripe-connect-utils');

if (!process.env.STRIPE_CONNECT_SECRET_KEY) console.warn('Missing STRIPE_CONNECT_SECRET_KEY for Stripe Connect webhook');
const stripe = new Stripe(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY);

function constructEvent(body, signature) {
  const secrets = String(process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  if (!secrets.length) throw new Error('Missing STRIPE_CONNECT_WEBHOOK_SECRET');
  let lastError = null;
  for (const secret of secrets) {
    try { return stripe.webhooks.constructEvent(body, signature, secret); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error('Invalid Stripe signature');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let stripeEvent;
  try {
    stripeEvent = constructEvent(event.body, event.headers['stripe-signature']);
  } catch (error) {
    console.error('stripe-connect-webhook signature error:', error.message);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  try {
    const supabase = getSupabase();

    if (stripeEvent.type === 'account.updated') {
      const account = stripeEvent.data.object;
      await updateConnectedAccountFromStripeAccount(supabase, account);
    }

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      await handleConnectCheckoutSession(supabase, session);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('stripe-connect-webhook error:', error);
    return { statusCode: 500, body: error.message || 'Connect webhook handler error' };
  }
};
