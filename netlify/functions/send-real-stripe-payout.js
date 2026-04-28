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

    const amountGrosze = Math.round(Number(payout.amount || 0) * 100);

    if (!amountGrosze || amountGrosze < 100) {
      throw new Error('INVALID_PAYOUT_AMOUNT');
    }

    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: amountGrosze,
        currency: 'pln',
        destination: account.stripe_account_id,
        metadata: {
          payout_request_id: payout.id,
          user_id: payout.user_id
        }
      }, {
        idempotencyKey: `payout_${payout.id}`
      });
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('insufficient')) {
        throw new Error('INSUFFICIENT_STRIPE_BALANCE');
      }
      throw new Error(`STRIPE_TRANSFER_FAILED: ${error.message}`);
    }

    const { error: updateError } = await supabase
      .from('payout_requests')
      .update({
        stripe_transfer_id: transfer.id,
        stripe_status: transfer.object || 'transfer',
        updated_at: new Date().toISOString()
      })
      .eq('id', payout.id);

    if (updateError) throw updateError;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, transfer_id: transfer.id })
    };
  } catch (error) {
    console.error('send-real-stripe-payout error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Stripe payout error' }) };
  }
};
