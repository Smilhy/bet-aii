import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  console.log("WEBHOOK START");

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
    return {
      statusCode: 400,
      body: "Webhook Error",
    };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    const email = session.customer_details?.email;
    const amount = session.amount_total / 100;

    if (!email) return { statusCode: 200 };

    const { data: user } = await supabase
      .from("profiles")
      .select("id, balance")
      .eq("email", email)
      .single();

    if (!user) return { statusCode: 200 };

    await supabase
      .from("profiles")
      .update({
        balance: (user.balance || 0) + amount,
      })
      .eq("id", user.id);
  }

  return {
    statusCode: 200,
    body: "ok",
  };
};