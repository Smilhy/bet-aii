const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function (event) {
  console.log("WEBHOOK START");

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const sig = event.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  console.log("EVENT TYPE:", stripeEvent.type);

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    const email =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email;

    const amount = Number(session.amount_total || 0) / 100;
    const sessionId = session.id;

    console.log("EMAIL:", email);
    console.log("AMOUNT:", amount);
    console.log("SESSION:", sessionId);

    if (!email || !amount || !sessionId) {
      console.error("Missing email, amount or session id");
      return {
        statusCode: 200,
        body: "missing data",
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, balance")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return {
        statusCode: 200,
        body: "profile not found",
      };
    }

    const { error: rpcError } = await supabase.rpc("add_balance_safe", {
      p_user_id: profile.id,
      p_amount: amount,
      p_session_id: sessionId,
    });

    if (rpcError) {
      console.error("add_balance_safe error:", rpcError);
      return {
        statusCode: 500,
        body: "balance update failed",
      };
    }

    console.log("BALANCE UPDATED");
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};