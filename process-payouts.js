const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { request_id } = JSON.parse(event.body || '{}');

    if (!request_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing request_id' }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: payout, error: payoutError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();

    if (payoutError) throw payoutError;
    if (!payout) throw new Error('PAYOUT_NOT_FOUND');
    if (payout.status !== 'pending') throw new Error('PAYOUT_ALREADY_PROCESSED');

    const { data: account, error: accountError } = await supabase
      .from('user_stripe_accounts')
      .select('*')
      .eq('user_id', payout.user_id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account?.stripe_account_id) throw new Error('STRIPE_CONNECT_NOT_CONNECTED');

    // Refresh account status from Stripe before transfer.
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

    await supabase.from('user_stripe_accounts').upsert({
      user_id: payout.user_id,
      stripe_account_id: account.stripe_account_id,
      charges_enabled: Boolean(stripeAccount.charges_enabled),
      payouts_enabled: Boolean(stripeAccount.payouts_enabled),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (!stripeAccount.payouts_enabled) {
      throw new Error('STRIPE_PAYOUTS_NOT_ENABLED');
    }

    const transfer = await stripe.transfers.create({
      amount: Math.round(Number(payout.amount) * 100),
      currency: 'pln',
      destination: account.stripe_account_id,
      metadata: {
        payout_request_id: payout.id,
        user_id: payout.user_id
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, transfer_id: transfer.id })
    };
  } catch (error) {
    console.error('send-tipster-payout error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Stripe payout error' }) };
  }
};
