const Stripe = require('stripe');

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

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://unique-queijadas-333bcd.netlify.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'pln',
            product_data: {
              name: 'BetAI Premium',
              description: 'Konto Premium: publikowanie typów premium, większe limity i monetyzacja analiz'
            },
            unit_amount: Number(process.env.PREMIUM_PRICE_GROSZE || 2900)
          },
          quantity: 1
        }
      ],
      success_url: `${siteUrl}/?premium=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?premium=cancel`,
      metadata: {
        kind: 'premium_access',
        user_id,
        amount: String(Number(process.env.PREMIUM_PRICE_GROSZE || 2900) / 100)
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (error) {
    console.error('create-premium-checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Stripe Premium checkout error' })
    };
  }
};
