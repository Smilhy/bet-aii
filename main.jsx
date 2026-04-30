// Bet+AI — Stripe-ready placeholder
// W kolejnym kroku podpinamy prawdziwe Netlify Functions + Stripe Checkout.

export const STRIPE_READY = true;

export function startStripeCheckout(tip) {
  console.log("Stripe Checkout placeholder:", tip);
  return {
    ok: true,
    message: "Stripe Checkout będzie podpięty w kroku 23."
  };
}
