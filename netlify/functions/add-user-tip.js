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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(401, { error: 'Zaloguj się, aby dodać typ.' })

    const supabase = getSupabaseAdmin()
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    const user = userData?.user
    if (userError || !user?.id) return json(401, { error: 'Sesja wygasła. Zaloguj się ponownie.' })

    const { tip = {} } = JSON.parse(event.body || '{}')
    const clean = {
      author_id: user.id,
      author_name: tip.author_name || (user.email ? user.email.split('@')[0] : 'Użytkownik'),
      league: String(tip.league || '').trim(),
      team_home: String(tip.team_home || '').trim(),
      team_away: String(tip.team_away || '').trim(),
      match_time: tip.match_time || null,
      bet_type: String(tip.bet_type || '').trim(),
      odds: Number(tip.odds || 0),
      analysis: String(tip.analysis || '').trim(),
      ai_probability: Math.max(0, Math.min(100, Number(tip.ai_probability || tip.ai_confidence || 0))),
      ai_confidence: Math.max(0, Math.min(100, Number(tip.ai_confidence || tip.ai_probability || 0))),
      ai_score: Math.max(0, Math.min(100, Number(tip.ai_score || 0))),
      ai_analysis: String(tip.ai_analysis || tip.analysis || '').trim(),
      access_type: tip.access_type === 'premium' ? 'premium' : 'free',
      is_premium: tip.access_type === 'premium' || tip.is_premium === true,
      price: tip.access_type === 'premium' ? Math.max(0, Number(tip.price || 0)) : 0,
      tags: Array.isArray(tip.tags) ? tip.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
      notify_followers: tip.notify_followers !== false,
      status: 'pending'
    }

    if (!clean.league || !clean.team_home || !clean.team_away || !clean.bet_type || !clean.odds) {
      return json(400, { error: 'Uzupełnij ligę, drużyny, typ i kurs.' })
    }

    let { data, error } = await supabase.from('tips').insert(clean).select('*').single()

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const baseTip = {
        author_id: clean.author_id,
        author_name: clean.author_name,
        league: clean.league,
        team_home: clean.team_home,
        team_away: clean.team_away,
        match_time: clean.match_time,
        bet_type: clean.bet_type,
        odds: clean.odds,
        analysis: clean.analysis,
        ai_probability: clean.ai_probability,
        access_type: clean.access_type,
        price: clean.price,
        status: clean.status,
        tags: clean.tags,
        notify_followers: clean.notify_followers
      }
      const retry = await supabase.from('tips').insert(baseTip).select('*').single()
      data = retry.data
      error = retry.error
    }

    if (error) throw error
    return json(200, { ok: true, tip: data })
  } catch (error) {
    console.error('add-user-tip error:', error)
    return json(500, { error: error.message || 'Nie udało się zapisać typu.' })
  }
}
