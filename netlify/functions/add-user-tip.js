const { createClient } = require('@supabase/supabase-js')

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

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value, 0))))
}

async function tryInsert(supabase, payloads) {
  let lastError = null
  for (const payload of payloads) {
    const { data, error } = await supabase.from('tips').insert(payload).select('*').single()
    if (!error) return { data, error: null }
    lastError = error
  }
  return { data: null, error: lastError }
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
    const accessType = tip.access_type === 'premium' ? 'premium' : 'free'
    const authorName = toText(tip.author_name, user.email ? user.email.split('@')[0] : 'Użytkownik')

    const base = {
      author_id: user.id,
      author_name: authorName,
      league: toText(tip.league),
      team_home: toText(tip.team_home),
      team_away: toText(tip.team_away),
      match_time: tip.match_time || null,
      bet_type: toText(tip.bet_type),
      odds: toNumber(tip.odds, 0),
      analysis: toText(tip.analysis),
      ai_probability: clampPercent(tip.ai_probability || tip.ai_confidence),
      access_type: accessType,
      price: accessType === 'premium' ? Math.max(0, toNumber(tip.price, 0)) : 0,
      status: 'pending',
      tags: Array.isArray(tip.tags) ? tip.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
      notify_followers: tip.notify_followers !== false
    }

    if (!base.league || !base.team_home || !base.team_away || !base.bet_type || !base.odds) {
      return json(400, { error: 'Uzupełnij ligę, drużyny, typ i kurs.' })
    }

    const payloads = [
      {
        ...base,
        user_id: user.id,
        author_email: user.email || null,
        ai_confidence: clampPercent(tip.ai_confidence || tip.ai_probability),
        ai_score: clampPercent(tip.ai_score),
        ai_analysis: toText(tip.ai_analysis || tip.analysis),
        is_premium: accessType === 'premium'
      },
      base,
      {
        author_id: base.author_id,
        author_name: base.author_name,
        league: base.league,
        team_home: base.team_home,
        team_away: base.team_away,
        bet_type: base.bet_type,
        odds: base.odds,
        analysis: base.analysis,
        ai_probability: base.ai_probability,
        access_type: base.access_type,
        price: base.price,
        status: base.status
      }
    ]

    const { data, error } = await tryInsert(supabase, payloads)
    if (error) throw error

    return json(200, { ok: true, tip: data })
  } catch (error) {
    console.error('add-user-tip error:', error)
    return json(500, { error: error.message || 'Nie udało się zapisać kuponu.' })
  }
}
