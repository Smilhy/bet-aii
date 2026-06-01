const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function todayWarsaw(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function cleanMode(value) {
  return String(value || 'today').toLowerCase() === 'tomorrow' ? 'tomorrow' : 'today'
}

function cleanDate(value, fallback) {
  const raw = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', bets: [] })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const qs = event.queryStringParameters || {}
  const mode = cleanMode(qs.mode)
  const fallbackDate = mode === 'tomorrow' ? todayWarsaw(1) : todayWarsaw(0)
  const date = cleanDate(qs.date, fallbackDate)
  const scope = String(qs.scope || 'day').toLowerCase()
  const limit = Math.max(1, Math.min(500, Number(qs.limit || (scope === 'journal' ? 200 : 150))))

  try {
    let query = supabase
      .from('ai_bets')
      .select('*')
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })
      .limit(limit)

    if (scope !== 'journal') query = query.eq('match_date', date)

    const { data, error } = await query
    if (error) throw error
    return json(200, { bets: data || [], date, mode, scope, count: (data || []).length })
  } catch (error) {
    return json(500, { error: error?.message || String(error), bets: [], date, mode, scope })
  }
}
