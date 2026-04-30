const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

async function resolvePremiumUserId(supabase, { userId, customerId, email, expectedUserId, expectedEmail }) {
  if (userId) return userId;

  if (customerId) {
    const { data: byProfileCustomer } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (byProfileCustomer?.id) return byProfileCustomer.id;

    const { data: bySubCustomer } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (bySubCustomer?.user_id) return bySubCustomer.user_id;
  }

  const emails = [email, expectedEmail].map(normalizeEmail).filter(Boolean);
  for (const e of emails) {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', e)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id;
  }

  if (expectedUserId) return expectedUserId;
  return null;
}

async function forcePremiumUpdate(supabase, payload) {
  const {
    userId,
    expectedUserId,
    email,
    expectedEmail,
    customerId,
    subscriptionId,
    status = 'active',
    currentPeriodEnd = null,
    cancelAtPeriodEnd = false,
    forcePremium = true
  } = payload;

  const resolvedUserId = await resolvePremiumUserId(supabase, {
    userId,
    expectedUserId,
    customerId,
    email,
    expectedEmail
  });

  if (!resolvedUserId) {
    throw new Error(`Premium sync failed: user not resolved for customer=${customerId || '-'} email=${email || expectedEmail || '-'}`);
  }

  const activeStatuses = ['active', 'trialing', 'paid', 'complete'];
  const isActive = forcePremium || activeStatuses.includes(String(status || '').toLowerCase());
  const plan = isActive ? 'premium' : 'free';
  const subscriptionStatus = isActive ? 'active' : (status || 'inactive');
  const periodEndIso = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;
  const finalEmail = normalizeEmail(email) || normalizeEmail(expectedEmail);

  const profilePayload = {
    plan,
    subscription_status: subscriptionStatus,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    current_period_end: periodEndIso
  };
  if (finalEmail) profilePayload.email = finalEmail;

  // Ensure profile exists before updating premium status.
  // This fixes new buyers whose auth.users row exists but public.profiles row was not created yet.
  const usernameFromEmail = finalEmail ? finalEmail.split('@')[0] : 'user';
  const { error: ensureProfileError } = await supabase
    .from('profiles')
    .upsert({
      id: resolvedUserId,
      email: finalEmail || null,
      username: usernameFromEmail,
      is_premium: isActive,
      plan,
      subscription_status: subscriptionStatus,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      current_period_end: periodEndIso,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (ensureProfileError) throw ensureProfileError;

  const { data: updatedProfile, error: profileError } = await supabase
    .from('profiles')
    .update({
      ...profilePayload,
      is_premium: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', resolvedUserId)
    .select('id,email,plan,subscription_status,stripe_customer_id,is_premium')
    .maybeSingle();

  if (profileError) throw profileError;
  if (!updatedProfile?.id) throw new Error(`Premium sync failed: profile update matched no rows for user_id=${resolvedUserId}`);

  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: resolvedUserId,
      plan,
      status: subscriptionStatus,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      current_period_end: periodEndIso,
      cancel_at_period_end: Boolean(cancelAtPeriodEnd),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (subscriptionError) {
    console.warn('Premium sync warning: user_subscriptions upsert failed:', subscriptionError.message);
  }

  return {
    ok: true,
    userId: resolvedUserId,
    plan,
    status: subscriptionStatus,
    profile: updatedProfile,
    subscriptionWarning: subscriptionError?.message || null
  };
}

module.exports = { getSupabase, normalizeEmail, resolvePremiumUserId, forcePremiumUpdate };
