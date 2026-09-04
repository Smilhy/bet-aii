const { createClient } = require('@supabase/supabase-js')

const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
const API_BASE = 'https://v3.football.api-sports.io'
const TABLE = 'match_prediction_snapshots'

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  } catch (_) {
    return null
  }
}

async function apiFixture(fixtureId, timeoutMs = 9000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}/fixtures?id=${encodeURIComponent(fixtureId)}`, {
      signal: controller.signal,
      headers: { 'x-apisports-key': API_KEY }
    })
    const payload = await response.json().catch(() => ({}))
    const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
    if (!response.ok || (errors && Object.keys(errors).length)) {
      throw new Error(errors && Object.keys(errors).length ? JSON.stringify(errors) : `API-Football HTTP ${response.status}`)
    }
    return Array.isArray(payload?.response) ? payload.response[0] || null : null
  } finally {
    clearTimeout(timer)
  }
}

function fixtureClass(fixture) {
  const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'void'
  return 'pending'
}

function regularTimeScore(fixture) {
  const short = String(fixture?.fixture?.status?.short || '').toUpperCase()
  const fulltime = fixture?.score?.fulltime || {}
  const homeRaw = ['AET', 'PEN'].includes(short) ? fulltime.home : (fixture?.goals?.home ?? fulltime.home)
  const awayRaw = ['AET', 'PEN'].includes(short) ? fulltime.away : (fixture?.goals?.away ?? fulltime.away)
  const home = Number(homeRaw)
  const away = Number(awayRaw)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  return { home, away }
}

async function mapConcurrent(items, limit, mapper) {
  let cursor = 0
  const results = new Array(items.length)
  const workers = Array.from({ length: Math.min(Math.max(1, limit), Math.max(1, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && !['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' })
  if (!API_KEY) return json(500, { ok: false, error: 'Brak APISPORTS_KEY / API_FOOTBALL_KEY.' })
  const supabase = getSupabase()
  if (!supabase) return json(500, { ok: false, error: 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.' })

  const requestedLimit = Number(event.queryStringParameters?.limit || 80)
  const limit = Math.max(1, Math.min(150, Number.isFinite(requestedLimit) ? requestedLimit : 80))
  // Sprawdzamy dopiero po 105 min od kickoffu. Mecze w dogrywce pozostaną pending
  // aż API-Football zwróci FT/AET/PEN.
  const cutoff = new Date(Date.now() - 105 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from(TABLE)
    .select('fixture_id,fixture_date,home_team,away_team,model_version,forecast,settled_at')
    .is('settled_at', null)
    .lte('fixture_date', cutoff)
    .order('fixture_date', { ascending: true })
    .limit(limit)

  if (error) return json(500, { ok: false, error: error.message, code: error.code })
  const rows = Array.isArray(data) ? data : []
  let settled = 0
  let voided = 0
  let pending = 0
  const errors = []

  await mapConcurrent(rows, 4, async row => {
    try {
      const fixture = await apiFixture(row.fixture_id)
      if (!fixture) { pending += 1; return }
      const state = fixtureClass(fixture)
      const fixtureStatus = String(fixture?.fixture?.status?.short || '')
      const now = new Date().toISOString()

      if (state === 'pending') {
        pending += 1
        return
      }

      if (state === 'void') {
        const { error: updateError } = await supabase.from(TABLE).update({
          settlement_status: 'void',
          fixture_status: fixtureStatus,
          settlement: {
            status: 'void',
            fixtureStatus,
            reason: 'Mecz anulowany/przerwany/nierozliczalny',
            settledAt: now
          },
          settled_at: now,
          updated_at: now
        }).eq('fixture_id', row.fixture_id).is('settled_at', null)
        if (updateError) throw updateError
        voided += 1
        return
      }

      const score = regularTimeScore(fixture)
      if (!score) { pending += 1; return }
      const { error: updateError } = await supabase.from(TABLE).update({
        actual_home_goals: score.home,
        actual_away_goals: score.away,
        settlement_status: 'settled',
        fixture_status: fixtureStatus,
        settlement: {
          status: 'settled',
          fixtureStatus,
          score,
          settledAt: now,
          source: 'API-Football'
        },
        locked_at: row.fixture_date || now,
        settled_at: now,
        updated_at: now
      }).eq('fixture_id', row.fixture_id).is('settled_at', null)
      if (updateError) throw updateError
      settled += 1
    } catch (err) {
      errors.push({ fixture_id: row.fixture_id, error: err?.message || String(err) })
    }
  })

  return json(200, {
    ok: true,
    checked: rows.length,
    settled,
    void: voided,
    stillPending: pending,
    errors: errors.slice(0, 12)
  })
}

exports._test = { fixtureClass, regularTimeScore }
