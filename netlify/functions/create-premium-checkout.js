const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user_id, email } = JSON.parse(event.body || '{}');

    if (!user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
    }

    const supabase = getSupabase();
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://unique-queijadas-333bcd.netlify.app';
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    const amount = Number(process.env.PREMIUM_MONTHLY_PRICE_GROSZE || process.env.PREMIUM_PRICE_GROSZE || 2900);

    let customerId = null;

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('stripe_customer_id,email')
      .eq('id', user_id)
      .maybeSingle();

    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .maybeSingle();

    customerId = existingProfile?.stripe_customer_id || existingSubscription?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || existingProfile?.email || undefined,
        metadata: {
          user_id,
          app: 'betai'
        }
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .upsert({
          id: user_id,
          email: email || existingProfile?.email || null,
          username: (email || existingProfile?.email || 'user').split('@')[0],
          is_admin: false,
          is_premium: false,
          plan: existingProfile?.plan || 'free',
          subscription_status: existingProfile?.subscription_status || 'inactive',
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      await supabase
        .from('user_subscriptions')
        .upsert({
          user_id,
          plan: 'free',
          status: 'inactive',
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    }

    // If this customer already has an active test/live subscription, do not create duplicates.
    // The frontend can call sync-premium-session on the existing customer after return, but here we keep checkout clean.
    if (customerId) {
      try {
        await stripe.customers.update(customerId, {
          email: email || existingProfile?.email || undefined,
          metadata: { user_id, app: 'betai' }
        });

        const activeSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1
        });

        if (activeSubscriptions.data?.length) {
          await supabase.from('profiles').update({
            plan: 'premium',
            subscription_status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: activeSubscriptions.data[0].id,
            current_period_end: activeSubscriptions.data[0].current_period_end
              ? new Date(activeSubscriptions.data[0].current_period_end * 1000).toISOString()
              : null
          }).eq('id', user_id);

          await supabase.from('user_subscriptions').upsert({
            user_id,
            plan: 'premium',
            status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: activeSubscriptions.data[0].id,
            current_period_end: activeSubscriptions.data[0].current_period_end
              ? new Date(activeSubscriptions.data[0].current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          return {
            statusCode: 200,
            body: JSON.stringify({ alreadyActive: true, url: `${siteUrl}/?premium=success&already_active=1` })
          };
        }
      } catch (subCheckError) {
        console.warn('Active subscription check warning:', subCheckError.message);
      }
    }

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
      customer: customerId,
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
