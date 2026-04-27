const Stripe = require("stripe");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:8888";

    if (!stripeSecretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Brak STRIPE_SECRET_KEY w Netlify Environment variables."
        })
      };
    }

    const stripe = new Stripe(stripeSecretKey);
    const body = JSON.parse(event.body || "{}");

    const tipId = body.tipId || "unknown";
    const userId = body.userId || "";
    const userEmail = body.userEmail || "";
    const matchName = body.matchName || "Typ premium";
    const price = Math.max(1, Number(body.price || 29));
    const amount = Math.round(price * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: {
              name: `Bet+AI Premium: ${matchName}`,
              description: `Odblokowanie typu premium ID: ${tipId}`
            },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      metadata: {
        tip_id: tipId,
        user_id: userId,
        amount_pln: String(price)
      },
      success_url: `${siteUrl}/?payment=success&tip=${encodeURIComponent(tipId)}`,
      cancel_url: `${siteUrl}/?payment=cancel`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url, id: session.id })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
