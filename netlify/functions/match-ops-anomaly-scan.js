const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const { logRun } = require('./_lib/match-ops-v211')

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) } }
function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}
function num(v) { const x = Number(v); return Number.isFinite(x) ? x : null }
function fingerprint(fixtureId, type) { return crypto.createHash('sha256').update(`${fixtureId || 'global'}|${type}`).digest('hex').slice(0, 48) }
function issue(fixtureId, type, severity, detail) { return { fingerprint: fingerprint(fixtureId, type), fixture_id: fixtureId ? String(fixtureId) : null, anomaly_type: type, severity, status: 'open', detail, last_seen_at: new Date().toISOString() } }
function inspect(row = {}) {
  const out = []
  const id = String(row.fixture_id || '')
  const f = row.forecast || {}
  const one = f.oneXTwo || {}
  const xgH = num(f?.xg?.home), xgA = num(f?.xg?.away)
  const ph = num(one.home), pd = num(one.draw), pa = num(one.away)
  const kickoff = Date.parse(row.fixture_date || '')
  if (!id) out.push(issue(null, 'missing_fixture_id', 'critical', {}))
  if (!row.home_team || !row.away_team || String(row.home_team).trim().toLowerCase() === String(row.away_team).trim().toLowerCase()) out.push(issue(id, 'invalid_team_identity', 'critical', { home: row.home_team, away: row.away_team }))
  if (!Number.isFinite(kickoff)) out.push(issue(id, 'invalid_fixture_date', 'critical', { fixtureDate: row.fixture_date }))
  if ((xgH != null && (xgH < 0 || xgH > 5)) || (xgA != null && (xgA < 0 || xgA > 5))) out.push(issue(id, 'xg_outlier', 'warning', { homeXg: xgH, awayXg: xgA }))
  if ([ph,pd,pa].every(v => v != null)) {
    const sum = ph + pd + pa
    if (Math.abs(sum - 100) > 2) out.push(issue(id, 'one_x_two_probability_sum', 'warning', { home: ph, draw: pd, away: pa, sum }))
    if ([ph,pd,pa].some(v => v < 0 || v > 100)) out.push(issue(id, 'probability_out_of_range', 'critical', { home: ph, draw: pd, away: pa }))
  }
  const goals = f.goals || {}
  for (const key of ['over15','over25','over35','btts']) {
    const p = num(goals[key]); if (p != null && (p < 0 || p > 100)) out.push(issue(id, `probability_out_of_range_${key}`, 'critical', { probability: p }))
  }
  if (row.settled_at && (row.actual_home_goals == null || row.actual_away_goals == null)) out.push(issue(id, 'settled_without_score', 'critical', { settledAt: row.settled_at }))
  if (!f.version && !row.model_version) out.push(issue(id, 'missing_model_version', 'warning', {}))
  if (Number(row.data_quality || 0) < 35) out.push(issue(id, 'very_low_data_quality', 'info', { dataQuality: Number(row.data_quality || 0) }))
  return out
}

exports.handler = async function handler() {
  const started = Date.now()
  const supabase = client()
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })
  try {
    const since = new Date(Date.now() - 45 * 86400000).toISOString()
    const { data, error } = await supabase.from('match_prediction_snapshots')
      .select('fixture_id,fixture_date,home_team,away_team,league,model_version,data_quality,forecast,actual_home_goals,actual_away_goals,settled_at,updated_at')
      .gte('fixture_date', since).order('fixture_date', { ascending: false }).limit(1500)
    if (error) throw error
    const anomalies = (data || []).flatMap(inspect)
    if (anomalies.length) {
      const { error: upsertError } = await supabase.from('match_data_anomalies').upsert(anomalies, { onConflict: 'fingerprint' })
      if (upsertError) throw upsertError
    }
    const critical = anomalies.filter(x => x.severity === 'critical').length
    const warning = anomalies.filter(x => x.severity === 'warning').length
    const info = anomalies.filter(x => x.severity === 'info').length
    const metrics = { scanned: (data || []).length, anomalies: anomalies.length, critical, warning, info }
    await logRun(supabase, 'anomaly_scan', started, critical ? 'partial' : 'ok', metrics)
    return json(200, { ok: true, ...metrics, sample: anomalies.slice(0, 20) })
  } catch (error) {
    await logRun(supabase, 'anomaly_scan', started, 'error', {}, error?.message || String(error))
    return json(500, { ok: false, error: error?.message || String(error) })
  }
}

exports._test = { inspect }
