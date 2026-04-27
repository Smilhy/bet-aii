
// Stripe webhook (step 24)
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"]
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    )

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object
      console.log("Płatność zakończona:", session.id)

      // tutaj w przyszłości zapis do Supabase unlocked_tips
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    }
  } catch (err) {
    return {
      statusCode: 400,
      body: `Webhook error: ${err.message}`
    }
  }
}
