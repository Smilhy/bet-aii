const { createClient } = require('@supabase/supabase-js')

const MODEL_VERSION = 'betai-ai-prediction-v13'
const TABLE = 'ai_prediction_history'

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'betai-ai-prediction-history-v13' } }
  })
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function round(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  const factor = 10 ** digits
  return Math.round(number * factor) / factor
}

function serializePrediction(row) {
  const kickoff = new Date(row?.kickoff || '')
  if (!row?.id || Number.isNaN(kickoff.getTime())) return null
  if (row.status !== 'upcoming' || kickoff.getTime() <= Date.now()) return null
  if (!['home', 'draw', 'away'].includes(String(row.pick_key || ''))) return null

  return {
    fixture_id: String(row.id),
    kickoff: kickoff.toISOString(),
    country: String(row.country || ''),
    league: String(row.league || ''),
    home_team: String(row.home?.name || ''),
    away_team: String(row.away?.name || ''),
    home_logo: String(row.home?.logo || ''),
    away_logo: String(row.away?.logo || ''),
    market_key: '1x2',
    pick_key: String(row.pick_key),
    pick_label: String(row.pick_label || ''),
    confidence: numberOrNull(row.confidence),
    true_odds: numberOrNull(row.true_odds),
    best_odds: numberOrNull(row.best_odds),
    bookmaker: String(row.best_bookmaker || ''),
    edge: numberOrNull(row.edge),
    model_source: String(row.model_source || ''),
    model_version: MODEL_VERSION,
    snapshot_payload: {
      outcomes: Array.isArray(row.outcomes) ? row.outcomes : [],
      advice: row.advice || '',
      expected_goals: row.expected_goals || {},
      comparison: row.comparison || {}
    },
    status: 'pending'
  }
}

async function recordPredictionSnapshots(predictions = []) {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, skipped: true, reason: 'missing_supabase_env' }
  const rows = predictions.map(serializePrediction).filter(Boolean)
  if (!rows.length) return { ok: true, inserted: 0 }

  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'fixture_id', ignoreDuplicates: true })

  if (error) return { ok: false, error: error.message, code: error.code }
  return { ok: true, inserted: rows.length }
}

function computeWindow(rows, days = null) {
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null
  const scoped = rows.filter(row => {
    if (!cutoff) return true
    const reference = Date.parse(row.settled_at || row.kickoff || '')
    return Number.isFinite(reference) && reference >= cutoff
  })
  const graded = scoped.filter(row => row.status === 'won' || row.status === 'lost')
  const wins = graded.filter(row => row.status === 'won').length
  const losses = graded.filter(row => row.status === 'lost').length
  const voids = scoped.filter(row => row.status === 'void').length
  const priced = graded.filter(row => Number.isFinite(Number(row.profit_units)))
  const profit = priced.reduce((sum, row) => sum + Number(row.profit_units || 0), 0)
  const odds = graded.map(row => Number(row.best_odds)).filter(value => Number.isFinite(value) && value > 1)
  const confidence = graded.map(row => Number(row.confidence)).filter(Number.isFinite)

  return {
    settled: graded.length,
    wins,
    losses,
    voids,
    accuracy: graded.length ? round(wins / graded.length * 100, 2) : 0,
    profit_units: round(profit, 2),
    roi: priced.length ? round(profit / priced.length * 100, 2) : 0,
    priced_bets: priced.length,
    avg_odds: odds.length ? round(odds.reduce((sum, value) => sum + value, 0) / odds.length, 2) : 0,
    avg_confidence: confidence.length ? round(confidence.reduce((sum, value) => sum + value, 0) / confidence.length, 2) : 0
  }
}

function computeStreak(rows) {
  const graded = rows.filter(row => row.status === 'won' || row.status === 'lost')
  if (!graded.length) return { type: 'none', count: 0, label: '—' }
  const type = graded[0].status
  let count = 0
  for (const row of graded) {
    if (row.status !== type) break
    count += 1
  }
  return {
    type,
    count,
    label: `${type === 'won' ? 'W' : 'L'}${count}`
  }
}

async function getPredictionStats() {
  const supabase = getSupabase()
  if (!supabase) return { available: false, reason: 'missing_supabase_env' }

  const [{ data, error }, pendingResult] = await Promise.all([
    supabase
      .from(TABLE)
      .select('fixture_id,kickoff,country,league,home_team,away_team,home_logo,away_logo,pick_key,pick_label,confidence,true_odds,best_odds,bookmaker,edge,status,actual_key,home_score,away_score,profit_units,settlement_reason,settled_at,created_at')
      .in('status', ['won', 'lost', 'void'])
      .order('settled_at', { ascending: false, nullsFirst: false })
      .limit(10000),
    supabase
      .from(TABLE)
      .select('fixture_id', { count: 'exact', head: true })
      .eq('status', 'pending')
  ])

  if (error) return { available: false, reason: error.message, code: error.code }
  if (pendingResult.error) return { available: false, reason: pendingResult.error.message, code: pendingResult.error.code }

  const rows = Array.isArray(data) ? data : []
  const recent = rows.slice(0, 12).map(row => ({
    id: row.fixture_id,
    kickoff: row.kickoff,
    country: row.country,
    league: row.league,
    home: { name: row.home_team, logo: row.home_logo },
    away: { name: row.away_team, logo: row.away_logo },
    pick_key: row.pick_key,
    pick_label: row.pick_label,
    confidence: numberOrNull(row.confidence),
    best_odds: numberOrNull(row.best_odds),
    bookmaker: row.bookmaker || '',
    edge: numberOrNull(row.edge),
    status: row.status,
    actual_key: row.actual_key,
    score: { home: row.home_score, away: row.away_score },
    profit_units: numberOrNull(row.profit_units),
    settled_at: row.settled_at,
    settlement_reason: row.settlement_reason || ''
  }))

  return {
    available: true,
    tracked_since: rows.length ? rows[rows.length - 1].created_at : null,
    pending: Number(pendingResult.count || 0),
    all: computeWindow(rows),
    last_30_days: computeWindow(rows, 30),
    last_7_days: computeWindow(rows, 7),
    streak: computeStreak(rows),
    recent
  }
}

module.exports = {
  MODEL_VERSION,
  TABLE,
  getSupabase,
  serializePrediction,
  recordPredictionSnapshots,
  getPredictionStats,
  computeWindow,
  computeStreak
}
