const { createClient } = require('@supabase/supabase-js')

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }
}
function clean(v, max = 180) { return String(v == null ? '' : v).trim().slice(0, max) }
function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch { return null }
}
function safeJson(v) {
  if (!v || typeof v !== 'object') return {}
  try { return JSON.parse(JSON.stringify(v)) } catch { return {} }
}
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })
  const supabase = getClient()
  if (!supabase) return json(503, { error: 'supabase_not_configured' })
  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'invalid_json' }) }
  const fixtureId = clean(body.fixtureId, 80)
  const seed = Number(body.seed)
  if (!fixtureId || !Number.isFinite(seed)) return json(400, { error: 'fixture_and_seed_required' })
  const runKey = `${fixtureId}:${Math.trunc(seed)}`
  const row = {
    run_key: runKey,
    fixture_id: fixtureId,
    simulation_seed: Math.trunc(seed),
    simulation_ordinal: Math.max(0, Math.trunc(Number(body.simulationOrdinal) || 0)),
    engine_version: clean(body.engineVersion || 'BETAI_REALISTIC_MATCH_ENGINE_V320', 100),
    prediction_version: clean(body.predictionVersion, 120),
    active_model: clean(body.activeModel, 120),
    home_team: clean(body.homeTeam),
    away_team: clean(body.awayTeam),
    league: clean(body.league),
    pre_match: safeJson(body.preMatch),
    final_score: safeJson(body.finalScore),
    final_stats: safeJson(body.finalStats),
    completed_at: new Date().toISOString()
  }
  const { error } = await supabase.from('match_simulation_runs_v320').upsert(row, { onConflict: 'run_key' })
  if (error) return json(500, { error: 'save_failed', message: error.message })
  return json(200, { ok: true, runKey })
}
