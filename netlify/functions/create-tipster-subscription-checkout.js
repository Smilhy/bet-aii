const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV.');
  return createClient(url, key);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';

    if (!stripeSecretKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Brak STRIPE_SECRET_KEY w Netlify Environment variables.' }) };
    }

    const stripe = new Stripe(stripeSecretKey);
    const supabase = getSupabase();
    const body = JSON.parse(event.body || '{}');

    const buyerId = body.userId || body.buyerId || '';
    const buyerEmail = body.userEmail || '';
    const referralCode = body.referralCode || '';
    const tipsterId = body.tipsterId || '';
    const planKey = body.planKey || body.key || '';
    const durationDaysFromBody = Number(body.durationDays || 0);

    if (!buyerId || !tipsterId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Brak buyerId albo tipsterId.' }) };
    }
    if (String(buyerId) === String(tipsterId)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nie możesz kupić dostępu do własnego profilu.' }) };
    }

    const { data: tipster } = await supabase
      .from('profiles')
      .select('id,email,display_name,username')
      .eq('id', tipsterId)
      .maybeSingle();

    let plan = null;
    if (planKey) {
      const { data } = await supabase
        .from('tipster_plans')
        .select('plan_key,label,duration_days,price,active')
        .eq('tipster_id', tipsterId)
        .eq('plan_key', planKey)
        .eq('active', true)
        .maybeSingle();
      plan = data || null;
    }

    const durationDays = Number(plan?.duration_days || durationDaysFromBody || 30);
    const label = plan?.label || body.label || `${durationDays} dni`;
    const rawPrice = plan?.price ?? body.price ?? 10;
    const price = roundMoney(rawPrice);

    if (durationDays <= 0) return { statusCode: 400, body: JSON.stringify({ error: 'Niepoprawny czas dostępu.' }) };
    if (price < 1) return { statusCode: 400, body: JSON.stringify({ error: 'Minimalna cena dostępu to 1 zł.' }) };

    const platformFee = roundMoney(price * 0.2);
    const tipsterAmount = roundMoney(price - platformFee);
    const tipsterName = body.tipsterName || tipster?.display_name || tipster?.username || tipster?.email || 'Tipster';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: buyerEmail || undefined,
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: {
            name: `BetAI: dostęp do profilu ${tipsterName}`,
            description: `Dostęp do typów premium: ${label}`
          },
          unit_amount: Math.round(price * 100)
        },
        quantity: 1
      }],
      client_reference_id: buyerId,
      metadata: {
        kind: 'tipster_profile_subscription',
        buyer_id: buyerId,
        user_id: buyerId,
        buyer_email: buyerEmail,
        tipster_id: tipsterId,
        tipster_name: tipsterName,
        plan_key: planKey || '',
        duration_days: String(durationDays),
        amount_pln: String(price),
        platform_fee: String(platformFee),
        tipster_amount: String(tipsterAmount),
        label,
        referral_code: referralCode
      },
      success_url: `${siteUrl}/?profile_sub=success&stripe=1&tipster=${encodeURIComponent(tipsterId)}`,
      cancel_url: `${siteUrl}/?profile_sub=cancel`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url, id: session.id }) };
  } catch (error) {
    console.error('create-tipster-subscription-checkout error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Checkout error' }) };
  }
};
