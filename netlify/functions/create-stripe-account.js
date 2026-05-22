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
  if (!url || !key) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
    const stripe = getStripe();
    const { user_id, email, country } = JSON.parse(event.body || '{}');

    if (!user_id) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing user_id' }) };

    const supabase = getSupabase();

    const { data: existing, error: existingError } = await supabase
      .from('user_stripe_accounts')
      .select('user_id,stripe_account_id,charges_enabled,payouts_enabled,details_submitted,connect_status')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingError) throw existingError;

    let account = null;
    let accountId = existing?.stripe_account_id || null;

    if (accountId) {
      try {
        account = await stripe.accounts.retrieve(accountId);
      } catch (error) {
        console.warn('Existing Stripe Connect account could not be retrieved, creating a new one:', error.message);
        accountId = null;
      }
    }

    if (!accountId) {
      account = await stripe.accounts.create({
        type: 'express',
        country: String(country || process.env.STRIPE_CONNECT_COUNTRY || 'GB').toUpperCase(),
        email: email || undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        },
        business_type: 'individual',
        metadata: { user_id, source: 'betai_connect_v6' }
      });
      accountId = account.id;
    }

    const payload = {
      user_id,
      stripe_account_id: accountId,
      charges_enabled: Boolean(account?.charges_enabled),
      payouts_enabled: Boolean(account?.payouts_enabled),
      details_submitted: Boolean(account?.details_submitted),
      connect_status: connectStatusFromAccount(account),
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('user_stripe_accounts')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    const siteUrl = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || process.env.URL || 'https://bet-ai.app';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/?stripe_connect=refresh`,
      return_url: `${siteUrl}/?stripe_connect=success&account_id=${encodeURIComponent(accountId)}`,
      type: 'account_onboarding'
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: accountLink.url, account_id: accountId, status: payload.connect_status })
    };
  } catch (error) {
    console.error('create-stripe-account error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message || 'Stripe Connect backend error' }) };
  }
};
