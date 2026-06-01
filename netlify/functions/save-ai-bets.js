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
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function cleanText(value, fallback = '') {
  const text = value == null ? '' : String(value)
  return text.trim() || fallback
}

function cleanDate(value) {
  const raw = cleanText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function cleanTime(value) {
  const raw = cleanText(value)
  const match = raw.match(/(\d{1,2}):(\d{2})/)
  if (match) return `${String(match[1]).padStart(2, '0')}:${match[2]}`
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
  return '12:00'
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeBet(row = {}) {
  const home = cleanText(row.home_team || row.home || row.team_home, 'Home')
  const away = cleanText(row.away_team || row.away || row.team_away, 'Away')
  const market = cleanText(row.market || row.bet_type, 'Typ AI')
  const prediction = cleanText(row.prediction || row.selection || row.pick, 'Predykcja AI')
  const external = cleanText(row.external_fixture_id || row.externalFixtureId || row.fixture_id || `${home}-${away}-${market}-${prediction}`)
  const now = new Date().toISOString()
  return {
    external_fixture_id: external,
    match_date: cleanDate(row.match_date || row.date || row.event_date || row.rawDate || row.match_time),
    match_time: cleanTime(row.match_time || row.event_time || row.rawDate || row.kickoff_time),
    home_team: home,
    away_team: away,
    country: cleanText(row.country, 'API-Sports'),
    league: cleanText(row.league || row.league_name, 'Liga'),
    market,
    prediction,
    odds: cleanNumber(row.odds || row.course, 1.5),
    probability: cleanNumber(row.probability || row.ai_probability || row.ai_confidence || row.confidence, 70),
    ev: cleanNumber(row.ev || row.value_score, 0),
    ai_score: cleanNumber(row.ai_score || row.aiScore || row.ai_confidence || row.confidence || row.probability, 70),
    status: cleanText(row.status, 'pending').toLowerCase(),
    result: row.result ? cleanText(row.result).toLowerCase() : null,
    profit: cleanNumber(row.profit, 0),
    source: cleanText(row.source, 'AI'),
    updated_at: now
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON body' }) }
  const input = Array.isArray(body?.bets) ? body.bets : []
  if (!input.length) return json(400, { error: 'No bets provided', saved: 0 })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const rows = input.map(normalizeBet).filter(row => row.home_team && row.away_team && row.market && row.prediction)
  let saved = 0
  const errors = []
  const ids = []

  for (const row of rows) {
    try {
      const { data: existing, error: findError } = await supabase
        .from('ai_bets')
        .select('id,status,result')
        .eq('external_fixture_id', row.external_fixture_id)
        .eq('market', row.market)
        .eq('prediction', row.prediction)
        .limit(1)
      if (findError) throw findError

      const existingId = existing?.[0]?.id
      if (existingId) {
        const alreadySettled = ['won', 'lost', 'void', 'push', 'win', 'loss'].includes(String(existing?.[0]?.status || existing?.[0]?.result || '').toLowerCase())
        const updateRow = alreadySettled
          ? Object.fromEntries(Object.entries(row).filter(([key]) => !['status', 'result', 'profit'].includes(key)))
          : row
        const { data, error } = await supabase.from('ai_bets').update(updateRow).eq('id', existingId).select('id').single()
        if (error) throw error
        ids.push(data?.id || existingId)
      } else {
        const { data, error } = await supabase.from('ai_bets').insert({ ...row, created_at: new Date().toISOString() }).select('id').single()
        if (error) throw error
        ids.push(data?.id)
      }
      saved += 1
    } catch (error) {
      errors.push({ match: `${row.home_team} vs ${row.away_team}`, market: row.market, prediction: row.prediction, error: error?.message || String(error) })
    }
  }

  try {
    await supabase.from('ai_pick_runs').insert({
      source: 'frontend-safe-quality-save-ai-bets',
      picks_created: saved,
      status: saved > 0 ? 'success' : 'error',
      error_message: errors.length ? JSON.stringify(errors).slice(0, 1000) : null,
      finished_at: new Date().toISOString()
    })
  } catch (_) {}

  return json(saved > 0 ? 200 : 400, { saved, attempted: rows.length, ids, errors: errors.slice(0, 10) })
}
