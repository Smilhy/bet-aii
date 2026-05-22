const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY);

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    if (!(process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) throw new Error('Missing STRIPE_CONNECT_SECRET_KEY');

    const { user_id, email, country } = JSON.parse(event.body || '{}');

    if (!user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
    }

    const supabase = getSupabase();

    const { data: existing, error: existingError } = await supabase
      .from('user_stripe_accounts')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingError) throw existingError;

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: String(country || process.env.STRIPE_CONNECT_COUNTRY || 'GB').toUpperCase(),
        email: email || undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        },
        business_type: 'individual',
        metadata: { user_id }
      });

      accountId = account.id;

      const { error: upsertError } = await supabase
        .from('user_stripe_accounts')
        .upsert({
          user_id,
          stripe_account_id: accountId,
          charges_enabled: Boolean(account.charges_enabled),
          payouts_enabled: Boolean(account.payouts_enabled),
          details_submitted: Boolean(account.details_submitted),
          connect_status: account.payouts_enabled ? 'active' : (account.details_submitted ? 'pending' : 'onboarding'),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;
    }

    const siteUrl =
      process.env.SITE_URL ||
      process.env.PUBLIC_SITE_URL ||
      'https://bet-ai.app';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/?stripe_connect=refresh`,
      return_url: `${siteUrl}/?stripe_connect=success&account_id=${encodeURIComponent(accountId)}`,
      type: 'account_onboarding'
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: accountLink.url,
        account_id: accountId
      })
    };
  } catch (error) {
    console.error('create-stripe-account error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Stripe Connect backend error' })
    };
  }
};
