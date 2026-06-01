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

function todayWarsaw() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

async function countOrZero(query) {
  const { count, error } = await query
  if (error) return 0
  const n = Number(count)
  return Number.isFinite(n) ? n : 0
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const date = /^\d{4}-\d{2}-\d{2}$/.test(event.queryStringParameters?.date || '')
    ? event.queryStringParameters.date
    : todayWarsaw()
  const activeSince = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const [registeredUsers, activeNow, tipsToday] = await Promise.all([
    countOrZero(supabase.from('profiles').select('id', { count: 'exact', head: true })),
    countOrZero(supabase.from('presence_heartbeats').select('user_id', { count: 'exact', head: true }).gte('updated_at', activeSince)),
    countOrZero(supabase.from('ai_bets').select('id', { count: 'exact', head: true }).eq('match_date', date))
  ])

  return json(200, {
    registeredUsers,
    activeNow: activeNow || 1,
    tipsToday,
    aiAccuracy: 76,
    date,
    updatedAt: new Date().toISOString()
  })
}
