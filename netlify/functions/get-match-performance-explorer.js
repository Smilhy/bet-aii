const { createClient } = require('@supabase/supabase-js')
const perf = require('./get-match-prediction-performance')
const { logRun } = require('./_lib/match-ops-v211')

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) } }
function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback }
function decision(row = {}) { return row?.forecast?.professionalLab?.decisionCard || row?.forecast?.value?.top || {} }
function filterRow(row, q) {
  const league = String(q.league || '').trim().toLowerCase()
  if (league && !String(row.league || '').toLowerCase().includes(league)) return false
  if (q.model && !String(row.model_version || '').toLowerCase().includes(String(q.model).toLowerCase())) return false
  if (q.from) { const t = Date.parse(row.fixture_date || ''); if (!Number.isFinite(t) || t < Date.parse(q.from)) return false }
  if (q.to) { const t = Date.parse(row.fixture_date || ''); if (!Number.isFinite(t) || t > Date.parse(q.to)) return false }
  if (n(q.min_quality, 0) > n(row.data_quality, 0)) return false
  const d = decision(row)
  if (n(q.min_edge, -999) > n(d.conservativeEdgePp ?? d.edgePp, -999)) return false
  if (n(q.min_confidence, 0) > n(d.conservativeProbability ?? d.calibratedProbability ?? d.probability, 0)) return false
  const odds = n(d.bookmakerOdds, 0)
  if (q.odds_min && odds < n(q.odds_min)) return false
  if (q.odds_max && odds > n(q.odds_max, 999)) return false
  return true
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  const started = Date.now(), supabase = client(), q = event.queryStringParameters || {}
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })
  try {
    const limit = Math.max(100, Math.min(12000, n(q.limit, 5000)))
    const { data, error } = await supabase.from('match_prediction_snapshots')
      .select('fixture_id,fixture_date,home_team,away_team,league,country,model_version,data_quality,forecast,actual_home_goals,actual_away_goals,settled_at')
      .not('actual_home_goals', 'is', null).not('actual_away_goals', 'is', null)
      .order('fixture_date', { ascending: false }).limit(limit)
    if (error) throw error
    const filtered = (data || []).filter(row => filterRow(row, q)).sort((a,b) => Date.parse(a.fixture_date || '') - Date.parse(b.fixture_date || ''))
    const summary = perf._test.aggregateRows(filtered)
    const marketKey = String(q.market || 'all')
    const market = marketKey === 'all' ? null : (summary.markets || []).find(x => x.key === marketKey) || null
    const recent = filtered.slice(-20).map(row => {
      const d = decision(row)
      return { fixtureId:row.fixture_id, fixtureDate:row.fixture_date, league:row.league, match:`${row.home_team} - ${row.away_team}`, dataQuality:row.data_quality, result:`${row.actual_home_goals}:${row.actual_away_goals}`, decision:d.decision || '', marketKey:d.key || '', probability:n(d.conservativeProbability ?? d.calibratedProbability ?? d.probability), edgePp:n(d.conservativeEdgePp ?? d.edgePp), odds:n(d.bookmakerOdds) }
    }).reverse()
    await logRun(supabase, 'performance_explorer', started, 'ok', { sourceRows:(data||[]).length, filteredRows:filtered.length, market:marketKey })
    return json(200, { ok:true, available:filtered.length>0, filters:{...q, market:marketKey}, matches:filtered.length, summary, market, recent })
  } catch (error) {
    await logRun(supabase, 'performance_explorer', started, 'error', {}, error?.message || String(error))
    return json(500, { ok:false, error:error?.message || String(error) })
  }
}

exports._test = { filterRow }
