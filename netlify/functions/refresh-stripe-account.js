const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function getStripe() {
  const key = process.env.STRIPE_CONNECT_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_CONNECT_SECRET_KEY');
  return new Stripe(key);
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

function connectStatusFromAccount(account) {
  if (account?.payouts_enabled) return 'connected';
  if (account?.details_submitted) return 'pending';
  return 'onboarding';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user_id } = JSON.parse(event.body || '{}');
    if (!user_id) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing user_id' }) };

    const stripe = getStripe();
    const supabase = getSupabase();

    const { data: row, error } = await supabase
      .from('user_stripe_accounts')
      .select('user_id,stripe_account_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!row?.stripe_account_id) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, connected: false }) };
    }

    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const update = {
      user_id,
      stripe_account_id: account.id,
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      connect_status: connectStatusFromAccount(account),
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('user_stripe_accounts')
      .upsert(update, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) };
  } catch (error) {
    console.error('refresh-stripe-account error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message || 'Refresh Stripe account error' }) };
  }
};
