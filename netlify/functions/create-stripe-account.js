const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user_id, email } = JSON.parse(event.body || '{}');

    if (!user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: existing } = await supabase
      .from('user_stripe_accounts')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || undefined,
        capabilities: {
          transfers: { requested: true }
        },
        metadata: { user_id }
      });

      accountId = account.id;

      const { error } = await supabase.from('user_stripe_accounts').upsert({
        user_id,
        stripe_account_id: accountId,
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) throw error;
    }

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://unique-queijadas-333bcd.netlify.app';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/?stripe_connect=refresh`,
      return_url: `${siteUrl}/?stripe_connect=success`,
      type: 'account_onboarding'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: accountLink.url, account_id: accountId })
    };
  } catch (error) {
    console.error('create-stripe-account error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Stripe Connect error' }) };
  }
};
