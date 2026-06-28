
const Stripe = require('stripe');
const { response, supabaseAdmin, requireAdmin, safeInsert, safeUpdatePayout } = require('./_admin-payout-security');

const stripe = new Stripe(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
const MIN_PAYOUT_AMOUNT = Number(process.env.MIN_PAYOUT_AMOUNT || 50);

async function markFailed(supabase, payout, message, adminUserId = null) {
  const now = new Date().toISOString();
  if (!supabase || !payout?.id) return;
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
    admin_user_id: adminUserId,
    action: 'payout_failed',
    target_table: 'payout_requests',
    target_id: payout.id,
    metadata: { error: String(message || ''), user_id: payout.user_id, amount: payout.amount }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });
  if (!(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) return response(500, { error: 'Missing STRIPE_CONNECT_SECRET_KEY' });

  let supabase = null;
  let payout = null;
  let admin = null;

  try {
    const body = JSON.parse(event.body || '{}');
    const { request_id } = body;
    if (!request_id) return response(400, { error: 'Missing request_id' });

    supabase = supabaseAdmin();
    admin = await requireAdmin(event, supabase, body);
    if (!admin.ok) return response(admin.statusCode || 403, { error: admin.error });

    const { data: payoutRow, error: payoutError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();

    if (payoutError) throw payoutError;
    payout = payoutRow;
    if (!payout) throw new Error('PAYOUT_NOT_FOUND');
    if (payout.status !== 'pending') throw new Error('PAYOUT_ALREADY_PROCESSED');
    if (Number(payout.amount || 0) < MIN_PAYOUT_AMOUNT) throw new Error(`MIN_PAYOUT_${MIN_PAYOUT_AMOUNT}_PLN`);

    const processingTime = new Date().toISOString();
    await safeUpdatePayout(supabase, payout.id, {
      status: 'processing',
      stripe_status: 'processing',
      approved_by: admin.admin_user_id,
      approved_at: processingTime,
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

    const amount = Number(payout.amount || 0);
    const amountMinor = Math.round(amount * 100);
    if (!amountMinor || amountMinor < 100) throw new Error('INVALID_PAYOUT_AMOUNT');

    const transfer = await stripe.transfers.create({
      amount: amountMinor,
      currency: (payout.currency || 'pln').toLowerCase(),
      destination: account.id,
      metadata: {
        payout_request_id: payout.id,
        user_id: payout.user_id,
        admin_user_id: admin.admin_user_id || '',
        source: 'betai_admin_payout'
      }
    }, { idempotencyKey: `betai_payout_${payout.id}` });

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
      admin_user_id: admin.admin_user_id,
      action: 'approve_payout_stripe_transfer',
      target_table: 'payout_requests',
      target_id: payout.id,
      metadata: {
        amount,
        user_id: payout.user_id,
        stripe_transfer_id: transfer.id,
        stripe_account_id: account.id,
        via: admin.via
      }
    });

    return response(200, { ok: true, status: 'paid', transfer_id: transfer.id });
  } catch (error) {
    if (supabase && payout) await markFailed(supabase, payout, error.message || error, admin?.admin_user_id || null);
    console.error('send-tipster-payout hardening error:', error);
    return response(500, { error: error.message || 'APPROVE_PAYOUT_FAILED' });
  }
};
