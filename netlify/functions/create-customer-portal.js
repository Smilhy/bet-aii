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
    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .maybeSingle();

    const { data: profileData } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .maybeSingle();

    const customerId = subData?.stripe_customer_id || profileData?.stripe_customer_id;

    if (!customerId) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Brak aktywnego klienta Stripe dla tego konta.' }) };
    }

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://unique-queijadas-333bcd.netlify.app';
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/?billing=return`
    });

    return { statusCode: 200, body: JSON.stringify({ url: portal.url }) };
  } catch (error) {
    console.error('create-customer-portal error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Stripe customer portal error' }) };
  }
};
