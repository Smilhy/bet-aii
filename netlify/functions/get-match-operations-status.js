const { createClient } = require('@supabase/supabase-js')

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) } }
function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}
function round(v, d = 1) { const n = Number(v); if (!Number.isFinite(n)) return 0; const f = 10 ** d; return Math.round(n * f) / f }

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  const supabase = client()
  if (!supabase) return json(503, { ok: false, available: false, error: 'Supabase ENV niedostępne' })
  try {
    const now = new Date(), day = now.toISOString().slice(0, 10), since24 = new Date(Date.now() - 86400000).toISOString(), since7 = new Date(Date.now() - 7 * 86400000).toISOString()
    const [runsQ, budgetQ, eventsQ, anomalyQ, canaryQ, freezeQ, queueQ, timelineQ, recentSnapshotsQ, cacheQ, profileQ] = await Promise.all([
      supabase.from('match_ops_runs').select('run_type,status,started_at,finished_at,duration_ms,metrics,error_text').order('started_at', { ascending: false }).limit(80),
      supabase.from('match_api_daily_budget').select('scope,used,updated_at').eq('budget_date', day),
      supabase.from('match_api_health_events').select('event_type,status_code,endpoint,created_at').gte('created_at', since24).order('created_at', { ascending: false }).limit(500),
      supabase.from('match_data_anomalies').select('severity,status,last_seen_at,anomaly_type').eq('status', 'open').gte('last_seen_at', since7).limit(1000),
      supabase.from('match_model_canary_state').select('*').eq('registry_key', 'football-main').maybeSingle(),
      supabase.from('match_prediction_freeze_ledger').select('*', { count: 'exact', head: true }),
      supabase.from('match_prediction_snapshots').select('*', { count: 'exact', head: true }).is('settled_at', null).lt('fixture_date', new Date(Date.now() - 105 * 60000).toISOString()),
      supabase.from('match_odds_timeline').select('fixture_id,snapshot_window,captured_at').gte('fixture_date', since7).lte('fixture_date', new Date(Date.now() + 86400000).toISOString()).limit(5000),
      supabase.from('match_prediction_snapshots').select('fixture_id').gte('fixture_date', since7).lte('fixture_date', new Date(Date.now() + 86400000).toISOString()).limit(5000),
      supabase.from('match_simulator_api_cache').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('match_data_science_profiles').select('updated_at,method,sample_size').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    ])
    const runs = runsQ.data || []
    const latestRuns = {}
    for (const r of runs) if (!latestRuns[r.run_type]) latestRuns[r.run_type] = r
    const budgets = budgetQ.data || []
    const budgetUsed = budgets.reduce((sum, x) => sum + Number(x.used || 0), 0)
    const events = eventsQ.data || []
    const eventCounts = events.reduce((a, x) => { a[x.event_type] = (a[x.event_type] || 0) + 1; return a }, {})
    const anomalies = anomalyQ.data || []
    const anomalyCounts = anomalies.reduce((a, x) => { a[x.severity] = (a[x.severity] || 0) + 1; return a }, { critical: 0, warning: 0, info: 0 })
    const recentFixtures = new Set((recentSnapshotsQ.data || []).map(x => String(x.fixture_id)))
    const timeline = timelineQ.data || []
    const byWindow = {}
    for (const key of ['T24H','T6H','T1H','T15M']) byWindow[key] = new Set(timeline.filter(x => x.snapshot_window === key).map(x => String(x.fixture_id)))
    const denom = Math.max(1, recentFixtures.size)
    const coverage = Object.fromEntries(Object.entries(byWindow).map(([k,set]) => [k, round(set.size / denom * 100, 1)]))
    const closingCoverage = coverage.T15M || 0
    const health = anomalyCounts.critical > 0 || (eventCounts.RATE_LIMIT || 0) >= 5 ? 'CRITICAL' : anomalyCounts.warning > 8 || (eventCounts.BUDGET_BLOCK || 0) > 0 ? 'WATCH' : 'HEALTHY'
    return json(200, {
      ok: true, available: true, generatedAt: new Date().toISOString(), health,
      api: { internalBudgetUsed: budgetUsed, scopes: budgets, events24h: eventCounts, lastEvents: events.slice(0, 8), cacheLastUpdate: cacheQ.data?.updated_at || null },
      settlement: { queue: Number(queueQ.count || 0), lastRun: latestRuns.settlement || null },
      odds: { windows: ['T24H','T6H','T1H','T15M'], coverage, closingCoveragePct: closingCoverage, lastRun: latestRuns.odds_snapshot || null },
      model: { canary: canaryQ.data || null, lastRebuild: latestRuns.model_rebuild || null, lastProfileUpdate: profileQ.data?.updated_at || null, lastProfileMethod: profileQ.data?.method || null },
      integrity: { frozenPredictions: Number(freezeQ.count || 0), openAnomalies7d: anomalies.length, anomalies: anomalyCounts, lastScan: latestRuns.anomaly_scan || null },
      runs: latestRuns
    })
  } catch (error) {
    return json(500, { ok: false, available: false, error: error?.message || String(error) })
  }
}
