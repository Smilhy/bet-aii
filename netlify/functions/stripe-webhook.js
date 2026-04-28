const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
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
      const userId = session.metadata?.user_id;

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

      if (userId && kind === 'premium_access') {
        const { error: subError } = await supabase
          .from('user_subscriptions')
          .upsert(
            { user_id: userId, plan: 'premium', updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
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
        if (txError && !String(txError.message || '').toLowerCase().includes('duplicate')) throw txError;
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('stripe-webhook error:', error);
    return { statusCode: 500, body: error.message || 'Webhook handler error' };
  }
};
