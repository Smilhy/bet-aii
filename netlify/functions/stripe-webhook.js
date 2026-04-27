const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" })
    };
  }

  const stripe = new Stripe(stripeSecretKey);
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe signature error:", error.message);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const userId = session.metadata?.user_id || null;
    const tipId = session.metadata?.tip_id || null;
    const amount = Number(session.metadata?.amount_pln || ((session.amount_total || 0) / 100));
    const currency = session.currency || "pln";

    if (supabaseUrl && serviceKey && userId && tipId) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false }
      });

      const { error: unlockError } = await supabase
        .from("unlocked_tips")
        .upsert({
          user_id: userId,
          tip_id: tipId,
          price: amount
        }, { onConflict: "user_id,tip_id" });

      if (unlockError) console.error("unlocked_tips error:", unlockError.message);

      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: userId,
          tip_id: tipId,
          stripe_session_id: session.id,
          amount,
          currency,
          status: "paid"
        });

      if (paymentError) console.error("payments error:", paymentError.message);
      else console.log("Payment saved:", { userId, tipId, amount, session: session.id });
    } else {
      console.error("Missing Supabase env or metadata", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
        userId,
        tipId
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};
