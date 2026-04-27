const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async function(event) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Stripe environment variables" })
    };
  }

  const stripe = new Stripe(stripeSecretKey);
  const signature = event.headers["stripe-signature"];

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (error) {
    return {
      statusCode: 400,
      body: `Webhook error: ${error.message}`
    };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const tipId = session.metadata?.tip_id;
    const userId = session.metadata?.user_id;
    const amount = Number(session.metadata?.amount_pln || 0);

    if (supabaseUrl && serviceRoleKey && tipId && userId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      await supabase
        .from("unlocked_tips")
        .upsert({
          user_id: userId,
          tip_id: tipId,
          price: amount
        }, { onConflict: "user_id,tip_id" });

      await supabase
        .from("payments")
        .insert({
          user_id: userId,
          tip_id: tipId,
          stripe_session_id: session.id,
          amount,
          currency: session.currency || "pln",
          status: "paid"
        });
    }

    console.log("Stripe payment completed", {
      session: session.id,
      tipId,
      userId,
      amount
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};
