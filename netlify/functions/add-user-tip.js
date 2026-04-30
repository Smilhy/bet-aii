const { createClient } = require('@supabase/supabase-js')

const BETAI_ADMIN_EMAILS = ['smilhytv@gmail.com']
const BETAI_PREMIUM_EMAILS = ['smilhytv@gmail.com', 'buchajson1988@gmail.com']
function normalizeEmail(value) { return String(value || '').trim().toLowerCase() }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function toText(value, fallback = '') {
  return String(value || fallback).trim()
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}


function formatTipInsertError(error) {
  const message = String(error?.message || error || '')
  if (message.includes('FREE_LIMIT') || message.includes('FREE_TIP_LIMIT_REACHED')) {
    return 'FREE_LIMIT: Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.'
  }
  if (message.includes('PREMIUM_REQUIRED')) {
    return 'PREMIUM_REQUIRED: Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.'
  }
  return message || 'Nie udało się zapisać kuponu.'
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value, 0))))
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(401, { error: 'Zaloguj się, aby dodać kupon.' })

    const supabase = getSupabaseAdmin()
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    const user = userData?.user
    if (userError || !user?.id) return json(401, { error: 'Sesja wygasła. Zaloguj się ponownie.' })

    const { tip = {} } = JSON.parse(event.body || '{}')
    const accessType = tip.access_type === 'premium' || tip.is_premium === true ? 'premium' : 'free'
    const authorName = toText(tip.author_name, user.email ? user.email.split('@')[0] : 'Użytkownik')

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin,is_premium,plan,subscription_status,email')
      .eq('id', user.id)
      .maybeSingle()

    let subscription = null
    let subscriptionResult = await supabase
      .from('user_subscriptions')
      .select('plan,status,current_period_end')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (subscriptionResult.error) {
      subscriptionResult = await supabase
        .from('user_subscriptions')
        .select('plan,status,current_period_end')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
    }
    if (!subscriptionResult.error) subscription = subscriptionResult.data

    const currentEmail = normalizeEmail(user.email)
    const isAdmin = Boolean(profile?.is_admin) || BETAI_ADMIN_EMAILS.includes(currentEmail)
    const isPremiumUser = BETAI_PREMIUM_EMAILS.includes(currentEmail) || Boolean(profile?.is_premium) || profile?.plan === 'premium' || ['active','trialing','premium'].includes(String(profile?.subscription_status || '').toLowerCase()) || subscription?.plan === 'premium' || ['active','trialing'].includes(subscription?.status) || isAdmin

    if (accessType === 'premium' && !isPremiumUser) {
      return json(403, { error: 'PREMIUM_REQUIRED: Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.' })
    }

    if (!isPremiumUser) {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { count, error: countError } = await supabase
        .from('tips')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())

      if (!countError && Number(count || 0) >= 5) {
        return json(403, { error: 'FREE_LIMIT: Masz maksymalny limit 5 typów dziennie na koncie FREE. Premium odblokowuje dodawanie bez limitu.' })
      }
    }

    const payload = {
      author_id: user.id,
      user_id: user.id,
      author_email: user.email || null,
      author_name: authorName,
      league: toText(tip.league),
      team_home: toText(tip.team_home),
      team_away: toText(tip.team_away),
      match_time: tip.match_time || null,
      bet_type: toText(tip.bet_type || tip.prediction),
      odds: toNumber(tip.odds, 0),
      analysis: toText(tip.analysis),
      ai_probability: clampPercent(tip.ai_probability || tip.ai_confidence),
      ai_score: clampPercent(tip.ai_score),
      ai_analysis: toText(tip.ai_analysis || tip.analysis),
      access_type: accessType,
      price: accessType === 'premium' ? Math.max(0, toNumber(tip.price, 0)) : 0,
      status: 'pending',
      tags: Array.isArray(tip.tags) ? tip.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
      notify_followers: tip.notify_followers !== false
    }

    if (!payload.league || !payload.team_home || !payload.team_away || !payload.bet_type || !payload.odds) {
      return json(400, { error: 'Uzupełnij ligę, drużyny, typ i kurs.' })
    }

    const { data, error } = await supabase.from('tips').insert(payload).select('*').single()
    if (!error) return json(200, { ok: true, tip: data })
    if (String(error.message || '').includes('non-DEFAULT value into column "is_premium"')) {
      const noGeneratedPayload = { ...payload }
      delete noGeneratedPayload.is_premium
      const retryGenerated = await supabase.from('tips').insert(noGeneratedPayload).select('*').single()
      if (!retryGenerated.error) return json(200, { ok: true, tip: retryGenerated.data })
    }

    const safePayload = {
      user_id: user.id,
      author_id: user.id,
      author_email: user.email || null,
      author_name: authorName,
      username: authorName,
      league: payload.league,
      team_home: payload.team_home,
      team_away: payload.team_away,
      match: `${payload.team_home} vs ${payload.team_away}`,
      match_time: payload.match_time,
      bet_type: payload.bet_type,
      prediction: payload.bet_type,
      odds: payload.odds,
      analysis: payload.analysis,
      ai_probability: payload.ai_probability,
      ai_score: payload.ai_score,
      ai_analysis: payload.ai_analysis,
      access_type: payload.access_type,
      price: payload.price,
      status: 'pending',
      tags: payload.tags,
      notify_followers: payload.notify_followers
    }

    let retryPayload = { ...safePayload }
    let lastError = error
    for (let i = 0; i < 10; i += 1) {
      const missingColumn = String(lastError?.message || '').match(/'([^']+)' column of 'tips'/)?.[1]
      if (!missingColumn || !(missingColumn in retryPayload)) break
      delete retryPayload[missingColumn]
      const retry = await supabase.from('tips').insert(retryPayload).select('*').single()
      if (!retry.error) return json(200, { ok: true, tip: retry.data, warning: 'Zapisano typ w trybie zgodności ze starszym schematem bazy.' })
      lastError = retry.error
    }

    throw lastError
  } catch (error) {
    console.error('add-user-tip error:', error)
    return json(500, { error: formatTipInsertError(error) })
  }
}
