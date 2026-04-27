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
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const kind = session.metadata?.kind;
      const userId = session.metadata?.user_id;

      if (!userId) {
        throw new Error('Missing user_id metadata');
      }

      if (kind === 'wallet_topup') {
        const amount = Number(session.metadata.amount || 0);
        if (!amount) throw new Error('Missing wallet amount metadata');

        const { error } = await supabase.from('wallet_transactions').insert({
          user_id: userId,
          amount,
          type: 'topup',
          provider: 'stripe',
          provider_session_id: session.id,
          status: 'completed'
        });

        if (error && !String(error.message || '').includes('duplicate')) throw error;
      }

      if (kind === 'premium_access') {
        const { error: subError } = await supabase
          .from('user_subscriptions')
          .upsert({ user_id: userId, plan: 'premium', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

        if (subError) throw subError;

        const amount = Number(session.metadata.amount || 29);
        const { error: txError } = await supabase.from('wallet_transactions').insert({
          user_id: userId,
          amount,
          type: 'premium_purchase',
          provider: 'stripe',
          provider_session_id: session.id,
          status: 'completed'
        });

        if (txError && !String(txError.message || '').includes('duplicate')) throw txError;
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('stripe-webhook error:', error);
    return { statusCode: 500, body: error.message || 'Webhook handler error' };
  }
};
