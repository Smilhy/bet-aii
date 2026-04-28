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

    const tipId = body.tipId;
    const buyerId = body.userId;
    const buyerEmail = body.userEmail || '';

    if (!tipId || !buyerId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Brak tipId albo userId.' }) };
    }

    const { data: tip, error: tipError } = await supabase
      .from('tips')
      .select('id,author_id,author_name,team_home,team_away,bet_type,price,is_premium,access_type')
      .eq('id', tipId)
      .maybeSingle();

    if (tipError) throw tipError;
    if (!tip) return { statusCode: 404, body: JSON.stringify({ error: 'Nie znaleziono typu.' }) };
    if (String(tip.author_id) === String(buyerId)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nie możesz kupić własnego typu.' }) };
    }

    const isPremiumTip = Boolean(tip.is_premium) || tip.access_type === 'premium';
    if (!isPremiumTip) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Ten typ jest darmowy.' }) };
    }

    const price = roundMoney(tip.price || body.price || 1);
    if (price < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Minimalna cena typu to 1 zł.' }) };
    }

    const platformFee = roundMoney(price * 0.2);
    const tipsterAmount = roundMoney(price - platformFee);
    const matchName = `${tip.team_home || ''} vs ${tip.team_away || ''}`.trim() || body.matchName || 'Typ premium';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: buyerEmail || undefined,
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: {
            name: `BetAI: ${matchName}`,
            description: `Odblokowanie pojedynczego typu premium`
          },
          unit_amount: Math.round(price * 100)
        },
        quantity: 1
      }],
      client_reference_id: buyerId,
      metadata: {
        kind: 'tip_purchase',
        user_id: buyerId,
        buyer_id: buyerId,
        buyer_email: buyerEmail,
        tip_id: tip.id,
        tipster_id: tip.author_id,
        amount_pln: String(price),
        platform_fee: String(platformFee),
        tipster_amount: String(tipsterAmount)
      },
      success_url: `${siteUrl}/?payment=success&stripe=1&tip=${encodeURIComponent(tip.id)}`,
      cancel_url: `${siteUrl}/?payment=cancel`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url, id: session.id }) };
  } catch (error) {
    console.error('create-checkout-session error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Checkout error' }) };
  }
};
