const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const signature = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature error:', error.message);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;

      if (session.metadata?.kind === 'wallet_topup') {
        const supabase = createClient(
          process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const userId = session.metadata.user_id;
        const amount = Number(session.metadata.amount || 0);

        if (!userId || !amount) {
          throw new Error('Missing wallet metadata');
        }

        const { error } = await supabase.from('wallet_transactions').insert({
          user_id: userId,
          amount,
          type: 'topup',
          provider: 'stripe',
          provider_session_id: session.id,
          status: 'completed'
        });

        if (error) {
          // unique duplicate means webhook retried, OK
          if (!String(error.message || '').includes('duplicate')) {
            throw error;
          }
        }
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('stripe-webhook error:', error);
    return { statusCode: 500, body: error.message || 'Webhook handler error' };
  }
};
