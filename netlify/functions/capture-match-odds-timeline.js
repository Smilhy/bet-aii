const { createClient } = require('@supabase/supabase-js')
const { apiGet } = require('./_lib/match-simulator-rate-shield')
const { normalizeFixtureOdds, marketProbability, fairOdds, edgePp } = require('./_lib/match-odds-normalizer-v211')
const { logRun } = require('./_lib/match-ops-v211')

const WINDOWS = [
  { key: 'T24H', minutes: 1440, tolerance: 90 },
  { key: 'T6H', minutes: 360, tolerance: 45 },
  { key: 'T1H', minutes: 60, tolerance: 15 },
  { key: 'T15M', minutes: 15, tolerance: 10 }
]

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }
}
function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}
function dueWindow(fixtureDate, nowMs = Date.now()) {
  const kickoff = Date.parse(fixtureDate || '')
  if (!Number.isFinite(kickoff) || kickoff <= nowMs) return null
  const minutesBefore = (kickoff - nowMs) / 60000
  let best = null
  for (const row of WINDOWS) {
    const delta = Math.abs(minutesBefore - row.minutes)
    if (delta <= row.tolerance && (!best || delta < best.delta)) best = { ...row, delta, actualMinutesBefore: minutesBefore }
  }
  return best
}
async function fetchOdds(fixtureId) {
  const response = await apiGet('/odds', { fixture: fixtureId, page: 1 }, {
    budgetScope: 'odds-timeline', budgetLimit: 120, totalBudgetLimit: 750,
    ttlMs: 2 * 60 * 1000, allowStaleMs: 15 * 60 * 1000, attempts: 2, timeoutMs: 9000
  })
  if (!response?.ok) return { ok: false, rows: [], response }
  return { ok: true, rows: Array.isArray(response.data) ? response.data : [], response }
}

exports.handler = async function handler(event = {}) {
  const started = Date.now()
  const supabase = client()
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })
  try {
    const now = Date.now()
    const from = new Date(now + 4 * 60 * 1000).toISOString()
    const to = new Date(now + 26 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('match_prediction_snapshots')
      .select('fixture_id,fixture_date,home_team,away_team,league,forecast,settled_at')
      .is('settled_at', null).gte('fixture_date', from).lte('fixture_date', to)
      .order('fixture_date', { ascending: true }).limit(120)
    if (error) throw error
    const candidates = (Array.isArray(data) ? data : []).map(row => ({ row, window: dueWindow(row.fixture_date, now) })).filter(x => x.window)
    if (!candidates.length) {
      await logRun(supabase, 'odds_snapshot', started, 'skipped', { scanned: Array.isArray(data) ? data.length : 0, due: 0, windows: WINDOWS.map(w => w.key) })
      return json(200, { ok: true, scanned: Array.isArray(data) ? data.length : 0, due: 0, capturedFixtures: 0, quotes: 0 })
    }

    const ids = [...new Set(candidates.map(x => String(x.row.fixture_id)))]
    const { data: existing } = await supabase.from('match_odds_timeline').select('fixture_id,snapshot_window').in('fixture_id', ids)
    const seen = new Set((existing || []).map(x => `${x.fixture_id}|${x.snapshot_window}`))
    let capturedFixtures = 0, quotes = 0, skipped = 0, apiErrors = 0, cacheHits = 0, budgetLimited = 0
    const errors = []

    for (const item of candidates) {
      const row = item.row, window = item.window
      const pair = `${row.fixture_id}|${window.key}`
      if (seen.has(pair)) { skipped += 1; continue }
      const fetched = await fetchOdds(row.fixture_id)
      if (!fetched.ok) {
        apiErrors += 1
        if (fetched.response?.budgetLimited) budgetLimited += 1
        errors.push({ fixtureId: row.fixture_id, window: window.key, error: fetched.response?.error || 'odds unavailable' })
        continue
      }
      if (fetched.response?.fromCache) cacheHits += 1
      const best = normalizeFixtureOdds(fetched.rows)
      const keys = Object.keys(best)
      if (!keys.length) { skipped += 1; continue }
      const nowIso = new Date().toISOString()
      const timelineRows = []
      const historyRows = []
      for (const key of keys) {
        const q = best[key]
        const p = marketProbability(row.forecast || {}, key)
        const fair = fairOdds(p)
        const edge = edgePp(p, q.odds)
        timelineRows.push({
          fixture_id: String(row.fixture_id), fixture_date: row.fixture_date || null,
          home_team: row.home_team || '', away_team: row.away_team || '', league: row.league || '',
          market_key: key, bookmaker: q.bookmaker || 'API-Football Odds', odds: q.odds,
          model_probability: p, fair_odds: fair, edge_pp: edge,
          snapshot_window: window.key, target_minutes_before: window.minutes,
          actual_minutes_before: Math.round(window.actualMinutesBefore * 100) / 100,
          source: 'API-Football /odds scheduled', is_closing_candidate: window.key === 'T15M', captured_at: nowIso,
          metadata: { page: 1, fromCache: Boolean(fetched.response?.fromCache), stale: Boolean(fetched.response?.stale) }
        })
        historyRows.push({
          fixture_id: String(row.fixture_id), fixture_date: row.fixture_date || null,
          market_key: key, bookmaker: q.bookmaker || 'API-Football Odds', odds: q.odds,
          model_probability: p, fair_odds: fair, edge_pp: edge,
          expected_value_pct: p != null ? Math.round(((p / 100) * q.odds - 1) * 1000) / 10 : null,
          captured_at: nowIso, is_closing: false, capture_window: window.key, capture_source: 'scheduled-v211'
        })
      }
      const { error: insertError } = await supabase.from('match_odds_timeline').upsert(timelineRows, { onConflict: 'fixture_id,snapshot_window,market_key,bookmaker', ignoreDuplicates: true })
      if (insertError) { errors.push({ fixtureId: row.fixture_id, window: window.key, error: insertError.message }); continue }
      try { await supabase.from('match_odds_history').insert(historyRows) } catch (_) {}
      seen.add(pair)
      capturedFixtures += 1
      quotes += timelineRows.length
    }

    const status = apiErrors || errors.length ? (capturedFixtures ? 'partial' : 'error') : 'ok'
    const metrics = { scanned: Array.isArray(data) ? data.length : 0, due: candidates.length, capturedFixtures, quotes, skipped, apiErrors, cacheHits, budgetLimited, windows: WINDOWS.map(w => w.key) }
    await logRun(supabase, 'odds_snapshot', started, status, metrics, errors[0]?.error || null)
    return json(status === 'error' ? 503 : 200, { ok: status !== 'error', ...metrics, errors: errors.slice(0, 10) })
  } catch (error) {
    await logRun(supabase, 'odds_snapshot', started, 'error', {}, error?.message || String(error))
    return json(500, { ok: false, error: error?.message || String(error) })
  }
}

exports._test = { dueWindow, WINDOWS }
