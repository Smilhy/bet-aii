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
  const base = new Date(Date.now() + Number(offsetDays || 0) * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(base).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', bets: [] })

  const params = event.queryStringParameters || {}
  const journal = String(params.journal || '') === '1'
  const offset = params.mode === 'tomorrow' ? 1 : 0
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date || '') ? params.date : todayWarsaw(offset)
  const limit = Math.min(Math.max(Number(params.limit || (journal ? 200 : 50)) || 50, 1), 500)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  let query = supabase.from('ai_bets').select('*')
  if (!journal) query = query.eq('match_date', date)
  query = query.order('match_date', { ascending: true }).order('match_time', { ascending: true }).limit(limit)

  const { data, error } = await query
  if (error) return json(500, { error: error.message, bets: [], date, journal })
  return json(200, { bets: data || [], count: (data || []).length, date, journal, updatedAt: new Date().toISOString() })
}
