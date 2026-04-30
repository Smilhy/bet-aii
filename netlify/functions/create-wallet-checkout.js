const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user_id, email, amount } = JSON.parse(event.body || '{}');

    if (!user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
    }

    const topupAmount = Number(amount || 100);
    const allowedAmounts = [50, 100, 200, 500];

    if (!allowedAmounts.includes(topupAmount)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nieprawidłowa kwota doładowania.' }) };
    }

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://unique-queijadas-333bcd.netlify.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      client_reference_id: user_id,
      line_items: [
        {
          price_data: {
            currency: 'pln',
            product_data: {
              name: `Doładowanie konta BetAI ${topupAmount} zł`,
              description: 'Realne saldo użytkownika w aplikacji BetAI'
            },
            unit_amount: Math.round(topupAmount * 100)
          },
          quantity: 1
        }
      ],
      success_url: `${siteUrl}/?wallet_topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?wallet_topup=cancel`,
      metadata: {
        kind: 'wallet_topup',
        user_id,
        email: email || '',
        amount: String(topupAmount)
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (error) {
    console.error('create-wallet-checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Stripe checkout error' })
    };
  }
};
