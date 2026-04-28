const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const MIN_PAYOUT_AMOUNT = Number(process.env.MIN_PAYOUT_AMOUNT || 50);
const MAX_BATCH = Number(process.env.PAYOUT_CRON_BATCH_SIZE || 10);

exports.config = {
  schedule: process.env.PAYOUT_CRON_SCHEDULE || '0 * * * *'
};

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

function response(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function isAuthorized(event) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '') || event.queryStringParameters?.secret;
  return token === cronSecret;
}

async function markFailed(supabase, payout, message) {
  const now = new Date().toISOString();
  await supabase
    .from('payout_requests')
    .update({ stripe_status: 'failed', updated_at: now })
    .eq('id', payout.id);

  await supabase.from('admin_logs').insert({
    admin_user_id: null,
    action: 'auto_payout_failed',
    target_table: 'payout_requests',
    target_id: payout.id,
    metadata: { error: message, user_id: payout.user_id, amount: payout.amount }
  });
}

async function processSinglePayout(supabase, payout) {
  const amount = Number(payout.amount || 0);
  if (amount < MIN_PAYOUT_AMOUNT) throw new Error(`MIN_PAYOUT_${MIN_PAYOUT_AMOUNT}_PLN`);

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

  const amountMinor = Math.round(amount * 100);
  const transfer = await stripe.transfers.create({
    amount: amountMinor,
    currency: (payout.currency || 'pln').toLowerCase(),
    destination: account.id,
    metadata: {
      payout_request_id: payout.id,
      user_id: payout.user_id,
      source: 'betai_auto_payout_cron'
    }
  }, { idempotencyKey: `betai_auto_payout_${payout.id}` });

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
    admin_user_id: null,
    action: 'auto_approve_payout_stripe_transfer',
    target_table: 'payout_requests',
    target_id: payout.id,
    metadata: {
      amount,
      user_id: payout.user_id,
      stripe_transfer_id: transfer.id,
      stripe_account_id: account.id
    }
  });

  return { id: payout.id, ok: true, transfer_id: transfer.id };
}

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return response(405, { error: 'Method not allowed' });
  if (!isAuthorized(event)) return response(401, { error: 'Unauthorized' });

  const supabase = supabaseAdmin();

  try {
    const { data: pending, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('status', 'pending')
      .gte('amount', MIN_PAYOUT_AMOUNT)
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH);

    if (error) throw error;

    const results = [];
    for (const payout of pending || []) {
      try {
        results.push(await processSinglePayout(supabase, payout));
      } catch (err) {
        const message = err.message || 'AUTO_PAYOUT_FAILED';
        await markFailed(supabase, payout, message);
        results.push({ id: payout.id, ok: false, error: message });
      }
    }

    return response(200, { ok: true, processed: results.length, results });
  } catch (error) {
    console.error('process-payouts error:', error);
    return response(500, { error: error.message || 'PROCESS_PAYOUTS_FAILED' });
  }
};
