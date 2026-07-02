const { getSupabase, TABLE } = require('./_lib/ai-prediction-history')

const API_SPORTS_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'

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

async function apiFetchFixture(fixtureId, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}/fixtures?id=${encodeURIComponent(fixtureId)}`, {
      headers: { 'x-apisports-key': API_SPORTS_KEY },
      signal: controller.signal
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || (payload.errors && Object.keys(payload.errors).length)) {
      throw new Error(`API-Football ${response.status}: ${JSON.stringify(payload.errors || {})}`)
    }
    return Array.isArray(payload.response) ? payload.response[0] || null : null
  } finally {
    clearTimeout(timeout)
  }
}

function classifyFixture(fixture) {
  const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'void'
  return 'pending'
}

function regularTimeScore(fixture) {
  const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
  const fulltime = fixture?.score?.fulltime || {}
  const useFulltime = ['AET', 'PEN'].includes(short)
  const home = useFulltime ? fulltime.home : (fixture?.goals?.home ?? fulltime.home)
  const away = useFulltime ? fulltime.away : (fixture?.goals?.away ?? fulltime.away)
  const homeNumber = Number(home)
  const awayNumber = Number(away)
  if (!Number.isFinite(homeNumber) || !Number.isFinite(awayNumber)) return null
  return { home: homeNumber, away: awayNumber }
}

function actualOutcome(score) {
  if (!score) return null
  if (score.home > score.away) return 'home'
  if (score.home < score.away) return 'away'
  return 'draw'
}

function settlementFor(row, fixture) {
  const fixtureClass = classifyFixture(fixture)
  if (fixtureClass === 'pending') return null
  if (fixtureClass === 'void') {
    return {
      status: 'void',
      actual_key: null,
      home_score: null,
      away_score: null,
      profit_units: 0,
      settlement_reason: `Mecz nierozliczalny: ${fixture?.fixture?.status?.short || 'VOID'}`,
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const score = regularTimeScore(fixture)
  const actual = actualOutcome(score)
  if (!score || !actual) return null
  const won = String(row.pick_key) === actual
  const odds = Number(row.best_odds)
  const profit = won ? (Number.isFinite(odds) && odds > 1 ? odds - 1 : null) : -1
  return {
    status: won ? 'won' : 'lost',
    actual_key: actual,
    home_score: score.home,
    away_score: score.away,
    profit_units: profit,
    settlement_reason: `1X2 po 90 minutach: ${score.home}:${score.away}; typ ${row.pick_key}; wynik ${actual}`,
    settled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

async function mapConcurrent(items, limit, mapper) {
  const output = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      output[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return output
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && !['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' })
  if (!API_SPORTS_KEY) return json(500, { ok: false, error: 'Brak APISPORTS_KEY / API_FOOTBALL_KEY.' })
  const supabase = getSupabase()
  if (!supabase) return json(500, { ok: false, error: 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.' })

  const requestedLimit = Number(event.queryStringParameters?.limit || 60)
  const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 60))
  // Nie zakładamy, że każdy mecz kończy się po dokładnie 90 minutach.
  // Po 105 minutach od planowanego startu sprawdzamy API; jeżeli mecz nadal trwa,
  // rekord pozostaje pending i wróci do kolejnego przebiegu.
  const cutoff = new Date(Date.now() - 105 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from(TABLE)
    .select('fixture_id,pick_key,best_odds,kickoff,status')
    .eq('status', 'pending')
    .lte('kickoff', cutoff)
    .order('kickoff', { ascending: false })
    .limit(limit)

  if (error) return json(500, { ok: false, error: error.message, code: error.code })
  const rows = Array.isArray(data) ? data : []
  const errors = []
  let settled = 0
  let won = 0
  let lost = 0
  let voided = 0

  await mapConcurrent(rows, 5, async row => {
    try {
      const fixture = await apiFetchFixture(row.fixture_id)
      if (!fixture) return
      const patch = settlementFor(row, fixture)
      if (!patch) return
      const { error: updateError } = await supabase.from(TABLE).update(patch).eq('fixture_id', row.fixture_id).eq('status', 'pending')
      if (updateError) throw updateError
      settled += 1
      if (patch.status === 'won') won += 1
      if (patch.status === 'lost') lost += 1
      if (patch.status === 'void') voided += 1
    } catch (errorItem) {
      errors.push({ fixture_id: row.fixture_id, error: errorItem?.message || String(errorItem) })
    }
  })

  return json(200, {
    ok: true,
    checked: rows.length,
    settled,
    won,
    lost,
    void: voided,
    pending: rows.length - settled,
    errors: errors.slice(0, 10)
  })
}

exports._test = { classifyFixture, regularTimeScore, actualOutcome, settlementFor }

// WERSJA 15 — realny dziennik uruchomień dla Centrum AI.
const { monitorHandler: monitorPredictionSettlementV15 } = require('./_lib/ai-system-monitor')
exports.handler = monitorPredictionSettlementV15({ systemKey: 'predictions', runType: 'settlement' }, exports.handler)
