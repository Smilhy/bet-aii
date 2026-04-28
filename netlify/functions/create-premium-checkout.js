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
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    const amount = Number(process.env.PREMIUM_MONTHLY_PRICE_GROSZE || process.env.PREMIUM_PRICE_GROSZE || 2900);

    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: 'pln',
            recurring: { interval: 'month' },
            product_data: {
              name: 'BetAI Premium Monthly',
              description: 'Subskrypcja Premium: paywall, typy premium, większe limity i monetyzacja analiz'
            },
            unit_amount: amount
          },
          quantity: 1
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      client_reference_id: user_id,
      line_items: [lineItem],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/?premium=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?premium=cancel`,
      metadata: {
        kind: 'premium_subscription',
        user_id,
        amount: String(amount / 100)
      },
      subscription_data: {
        metadata: {
          kind: 'premium_subscription',
          user_id
        }
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
      body: JSON.stringify({ error: error.message || 'Stripe Premium subscription checkout error' })
    };
  }
};
