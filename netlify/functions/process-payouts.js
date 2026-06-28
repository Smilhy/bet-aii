
const Stripe = require('stripe');
const { response, supabaseAdmin, safeInsert, safeUpdatePayout } = require('./_admin-payout-security');

const stripe = new Stripe(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
const MIN_PAYOUT_AMOUNT = Number(process.env.MIN_PAYOUT_AMOUNT || 50);
const MAX_BATCH = Number(process.env.PAYOUT_CRON_BATCH_SIZE || 10);

exports.config = {
  schedule: process.env.PAYOUT_CRON_SCHEDULE || '0 * * * *'
};

function isAuthorized(event) {
  const cronSecret = process.env.PAYOUT_CRON_SECRET || process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  const isScheduled = event.headers['x-netlify-scheduled-function'] === 'true' || event.headers['X-Netlify-Scheduled-Function'] === 'true';
  if (isScheduled) return true;
  if (!cronSecret) return false;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  const querySecret = event.queryStringParameters?.secret || '';
  const headerSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'] || '';
  return [bearer, querySecret, headerSecret].some(token => token && token === cronSecret);
}

async function markFailed(supabase, payout, message) {
  const now = new Date().toISOString();
  await supabase
    .from('payout_requests')
    .update({
      status: 'failed',
      stripe_status: 'failed',
      stripe_error: String(message || '').slice(0, 500),
      processed_at: now,
      updated_at: now
    })
    .eq('id', payout.id)
    .in('status', ['processing', 'pending']);

  await safeInsert(supabase, 'admin_logs', {
    admin_user_id: null,
    action: 'auto_payout_failed',
    target_table: 'payout_requests',
    target_id: payout.id,
    metadata: { error: String(message || ''), user_id: payout.user_id, amount: payout.amount }
  });
}

async function processSinglePayout(supabase, payout) {
  const amount = Number(payout.amount || 0);
  if (amount < MIN_PAYOUT_AMOUNT) throw new Error(`MIN_PAYOUT_${MIN_PAYOUT_AMOUNT}_PLN`);

  const processingTime = new Date().toISOString();
  await safeUpdatePayout(supabase, payout.id, {
    status: 'processing',
    stripe_status: 'processing',
    updated_at: processingTime
  }, 'pending');

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
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  if (!account.payouts_enabled) throw new Error('STRIPE_PAYOUTS_NOT_ENABLED');

  const amountMinor = Math.round(amount * 100);
  if (!amountMinor || amountMinor < 100) throw new Error('INVALID_PAYOUT_AMOUNT');

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

  await safeUpdatePayout(supabase, payout.id, {
    status: 'paid',
    stripe_transfer_id: transfer.id,
    stripe_status: 'transferred',
    processed_at: now,
    updated_at: now
  }, 'processing');

  await safeInsert(supabase, 'wallet_transactions', {
    user_id: payout.user_id,
    amount: -amount,
    type: 'payout',
    status: 'completed',
    provider: 'stripe',
    provider_session_id: transfer.id,
    created_at: now
  });

  await safeInsert(supabase, 'admin_logs', {
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
  if (!(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) return response(500, { error: 'Missing STRIPE_CONNECT_SECRET_KEY' });
  if (!isAuthorized(event)) return response(401, { error: 'Unauthorized: set PAYOUT_CRON_SECRET/CRON_SECRET or use Netlify scheduled function' });

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
        await markFailed(supabase, payout, err.message || err);
        results.push({ id: payout.id, ok: false, error: err.message || String(err) });
      }
    }

    return response(200, {
      ok: true,
      processed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results
    });
  } catch (error) {
    console.error('process-payouts hardening error:', error);
    return response(500, { error: error.message || 'PROCESS_PAYOUTS_FAILED' });
  }
};
