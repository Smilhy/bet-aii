const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const MIN_PAYOUT_AMOUNT = Number(process.env.MIN_PAYOUT_AMOUNT || 50);

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

function response(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const { request_id, admin_user_id } = JSON.parse(event.body || '{}');
    if (!request_id) return response(400, { error: 'Missing request_id' });

    const supabase = supabaseAdmin();

    const { data: payout, error: payoutError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();

    if (payoutError) throw payoutError;
    if (!payout) throw new Error('PAYOUT_NOT_FOUND');
    if (payout.status !== 'pending') throw new Error('PAYOUT_ALREADY_PROCESSED');

    const { data: accountRow, error: accountError } = await supabase
      .from('user_stripe_accounts')
      .select('*')
      .eq('user_id', payout.user_id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!accountRow?.stripe_account_id) throw new Error('STRIPE_CONNECT_NOT_CONNECTED');

    const account = await stripe.accounts.retrieve(accountRow.stripe_account_id);

    await supabase.from('user_stripe_accounts').upsert({
      user_id: payout.user_id,
      stripe_account_id: account.id,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (!account.payouts_enabled) throw new Error('STRIPE_PAYOUTS_NOT_ENABLED');

    const amount = Number(payout.amount || 0);
    const amountMinor = Math.round(amount * 100);
    if (!amountMinor || amount < MIN_PAYOUT_AMOUNT) throw new Error(`MIN_PAYOUT_${MIN_PAYOUT_AMOUNT}_PLN`);

    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: amountMinor,
        currency: (payout.currency || 'pln').toLowerCase(),
        destination: account.id,
        metadata: {
          payout_request_id: payout.id,
          user_id: payout.user_id,
          admin_user_id: admin_user_id || ''
        }
      }, { idempotencyKey: `betai_payout_${payout.id}` });
    } catch (e) {
      if (String(e.message || '').toLowerCase().includes('insufficient')) {
        throw new Error('INSUFFICIENT_STRIPE_BALANCE');
      }
      throw new Error(`STRIPE_TRANSFER_FAILED: ${e.message}`);
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('payout_requests')
      .update({
        status: 'paid',
        stripe_transfer_id: transfer.id,
        stripe_status: 'transferred',
        processed_at: now,
        updated_at: now
      })
      .eq('id', payout.id)
      .eq('status', 'pending');

    if (updateError) throw updateError;

    await supabase.from('wallet_transactions').insert({
      user_id: payout.user_id,
      amount: -amount,
      type: 'payout',
      status: 'completed',
      provider: 'stripe',
      provider_session_id: transfer.id
    });

    await supabase.from('admin_logs').insert({
      admin_user_id: admin_user_id || null,
      action: 'approve_payout_stripe_transfer',
      target_table: 'payout_requests',
      target_id: payout.id,
      metadata: {
        amount,
        user_id: payout.user_id,
        stripe_transfer_id: transfer.id,
        stripe_account_id: account.id
      }
    });

    return response(200, { ok: true, status: 'paid', transfer_id: transfer.id });
  } catch (error) {
    console.error('approve-payout error:', error);
    return response(500, { error: error.message || 'APPROVE_PAYOUT_FAILED' });
  }
};
