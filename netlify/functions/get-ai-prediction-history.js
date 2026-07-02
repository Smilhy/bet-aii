const {
  getSupabase,
  TABLE,
  HISTORY_SELECT,
  mapHistoryRow,
  getPredictionStats
} = require('./_lib/ai-prediction-history')

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function normalizeStatus(value) {
  const status = String(value || 'all').toLowerCase()
  if (['all', 'pending', 'won', 'lost', 'void', 'settled'].includes(status)) return status
  return 'all'
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })

  const supabase = getSupabase()
  if (!supabase) return json(500, { ok: false, error: 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.' })

  const query = event.queryStringParameters || {}
  const page = clampInteger(query.page, 1, 1, 100000)
  const limit = clampInteger(query.limit, 50, 1, 100)
  const status = normalizeStatus(query.status)
  const from = (page - 1) * limit
  const to = from + limit - 1

  let historyQuery = supabase
    .from(TABLE)
    .select(HISTORY_SELECT, { count: 'exact' })
    .order('kickoff', { ascending: false })
    .range(from, to)

  if (status === 'settled') historyQuery = historyQuery.in('status', ['won', 'lost', 'void'])
  else if (status !== 'all') historyQuery = historyQuery.eq('status', status)

  const [{ data, error, count }, stats] = await Promise.all([
    historyQuery,
    getPredictionStats()
  ])

  if (error) return json(500, { ok: false, error: error.message, code: error.code })

  const rows = (Array.isArray(data) ? data : []).map(mapHistoryRow)
  const total = Number(count || 0)

  return json(200, {
    ok: true,
    page,
    limit,
    status,
    total,
    pages: total ? Math.ceil(total / limit) : 0,
    has_more: to + 1 < total,
    rows,
    stats
  })
}

exports._test = { clampInteger, normalizeStatus }
