const Stripe = require('stripe');
const { getSupabase, normalizeEmail } = require('./stripe-premium-utils');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function ensureProfile(supabase, { userId, email }) {
  if (!userId) return;
  const normalizedEmail = normalizeEmail(email);
  // Insert only. Never update existing profiles here, because an existing admin/premium
  // profile must not be accidentally downgraded during a wallet top-up sync.
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: normalizedEmail || null,
      username: normalizedEmail ? normalizedEmail.split('@')[0] : 'user',
      is_admin: false,
      is_premium: false
    }, { onConflict: 'id', ignoreDuplicates: true });

  if (error) console.warn('ensureProfile warning:', error.message);
}

async function recordWalletTopup(supabase, session, expectedUserId = null) {
  const metadata = session.metadata || {};
  const userId = session.client_reference_id || metadata.user_id || expectedUserId;
  if (!userId) throw new Error('Nie można przypisać płatności do użytkownika. Brak user_id.');
  if (expectedUserId && String(userId) !== String(expectedUserId)) {
    throw new Error('Sesja Stripe nie należy do zalogowanego użytkownika.');
  }

  const kind = metadata.kind;
  if (kind !== 'wallet_topup') throw new Error('To nie jest sesja doładowania portfela.');

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid) throw new Error('Stripe nie potwierdził jeszcze płatności.');

  const amount = roundMoney(metadata.amount || (session.amount_total || 0) / 100);
  if (!amount || amount <= 0) throw new Error('Nieprawidłowa kwota doładowania.');

  const email = session.customer_details?.email || session.customer_email || metadata.email || null;
  await ensureProfile(supabase, { userId, email });

  let rpcResult = null;
  try {
    const { data, error } = await supabase.rpc('record_wallet_topup_final', {
      p_user_id: userId,
      p_amount: amount,
      p_session_id: session.id,
      p_email: email || null
    });
    if (error) throw error;
    rpcResult = Array.isArray(data) ? data[0] : data;
  } catch (rpcError) {
    console.warn('record_wallet_topup_final unavailable, using legacy wallet sync:', rpcError.message);

    const payload = {
      user_id: userId,
      amount,
      type: 'topup',
      provider: 'stripe',
      provider_session_id: session.id,
      status: 'completed'
    };

    const { error } = await supabase
      .from('wallet_transactions')
      .upsert(payload, { onConflict: 'provider_session_id' });

    if (error) throw error;

    try {
      await supabase.rpc('add_balance_safe', {
        p_user_id: userId,
        p_amount: amount,
        p_session_id: session.id
      });
    } catch (legacyError) {}
  }

  const { data: balance, error: balanceError } = await supabase.rpc('get_wallet_balance', { p_user_id: userId });
  if (balanceError) throw balanceError;

  return {
    userId,
    amount,
    balance: Number(balance || rpcResult?.balance || 0),
    sessionId: session.id,
    alreadyProcessed: Boolean(rpcResult?.already_processed)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { session_id, expected_user_id } = JSON.parse(event.body || '{}');
    if (!session_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const supabase = getSupabase();
    const result = await recordWalletTopup(supabase, session, expected_user_id || null);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ...result })
    };
  } catch (error) {
    console.error('sync-wallet-session error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Wallet sync error' })
    };
  }
};

module.exports.recordWalletTopup = recordWalletTopup;
