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
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user_id } = JSON.parse(event.body || '{}');
    if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };

    const supabase = getSupabase();

    const { data: row, error } = await supabase
      .from('user_stripe_accounts')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!row?.stripe_account_id) throw new Error('STRIPE_CONNECT_NOT_CONNECTED');

    const account = await stripe.accounts.retrieve(row.stripe_account_id);

    const update = {
      user_id,
      stripe_account_id: account.id,
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('user_stripe_accounts')
      .upsert(update, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    };
  } catch (error) {
    console.error('refresh-stripe-account error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Refresh Stripe account error' }) };
  }
};
