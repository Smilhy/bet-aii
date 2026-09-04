const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) } }
function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}
function sha(v) { return crypto.createHash('sha256').update(String(v)).digest('hex') }
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}
function verifyFreeze(row = {}) {
  if (!row.canonical_hash_v211) return null
  const payload = { fixtureId:String(row.fixture_id), fixtureDate:row.fixture_date||null, homeTeam:row.home_team||'', awayTeam:row.away_team||'', league:row.league||'', country:row.country||'', forecast:row.forecast||{} }
  return sha(stableStringify(payload)) === String(row.canonical_hash_v211 || '')
}
function compactFreeze(row = {}) {
  const f = row.forecast || {}, dc = f?.professionalLab?.decisionCard || {}, kickoff = Date.parse(row.fixture_date || ''), at = Date.parse(row.captured_at || '')
  const mins = Number.isFinite(kickoff) && Number.isFinite(at) ? Math.round((kickoff - at) / 60000) : null
  return {
    type: 'forecast', capturedAt: row.captured_at, minutesBeforeKickoff: mins, modelVersion: row.model_version,
    activeModel: row.active_model, dataQuality: row.data_quality, freezeHash: row.canonical_hash_v211 || row.freeze_hash, legacyFreezeHash: row.freeze_hash || null,
    hashVerified: verifyFreeze(row), verificationStatus: row.canonical_hash_v211 ? (verifyFreeze(row) ? 'VERIFIED' : 'FAILED') : 'LEGACY_UNVERIFIABLE',
    selectedForBacktest: Boolean(row.selected_for_backtest), selectionReason: row.selection_reason || '',
    oneXTwo: f.oneXTwo || null, goals: f.goals || null, xg: f.xg || null,
    decision: dc?.decision || f?.value?.state || '', marketKey: dc?.key || f?.value?.top?.key || '',
    probability: Number(dc?.conservativeProbability || dc?.calibratedProbability || f?.value?.top?.probability || 0),
    edgePp: Number(dc?.conservativeEdgePp || f?.value?.top?.edgePp || 0),
    sourceWeights: f.sourceWeights || null, modelInputs: f.modelInputs || null,
    reliability: f.reliability || null, abstention: f?.reliabilityV190?.abstention || null
  }
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  const fixtureId = String(event.queryStringParameters?.fixture || event.queryStringParameters?.fixture_id || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  if (!fixtureId) return json(400, { ok: false, error: 'Brak fixture id' })
  const supabase = client()
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })
  try {
    const [freezeQ, oddsQ, snapshotQ] = await Promise.all([
      supabase.from('match_prediction_freeze_ledger').select('fixture_id,fixture_date,home_team,away_team,league,country,captured_at,model_version,active_model,data_quality,freeze_hash,canonical_hash_v211,selected_for_backtest,selection_reason,forecast,integrity').eq('fixture_id', fixtureId).order('captured_at', { ascending: true }).limit(100),
      supabase.from('match_odds_timeline').select('fixture_id,fixture_date,market_key,bookmaker,odds,model_probability,fair_odds,edge_pp,snapshot_window,target_minutes_before,actual_minutes_before,is_closing_candidate,captured_at').eq('fixture_id', fixtureId).order('captured_at', { ascending: true }).limit(500),
      supabase.from('match_prediction_snapshots').select('fixture_id,fixture_date,home_team,away_team,league,country,actual_home_goals,actual_away_goals,settlement_status,settled_at,forecast').eq('fixture_id', fixtureId).maybeSingle()
    ])
    const freezes = (freezeQ.data || []).map(compactFreeze)
    const odds = (oddsQ.data || []).map(row => ({ type:'odds', capturedAt:row.captured_at, window:row.snapshot_window, marketKey:row.market_key, bookmaker:row.bookmaker, odds:Number(row.odds), modelProbability:Number(row.model_probability || 0), fairOdds:Number(row.fair_odds || 0), edgePp:Number(row.edge_pp || 0), minutesBeforeKickoff:Number(row.actual_minutes_before), closingCandidate:Boolean(row.is_closing_candidate) }))
    const events = [...freezes, ...odds].sort((a,b) => Date.parse(a.capturedAt || '') - Date.parse(b.capturedAt || ''))
    const verified = freezes.filter(x => x.hashVerified === true).length
    const verifiable = freezes.filter(x => x.hashVerified !== null).length
    const legacy = freezes.filter(x => x.hashVerified === null).length
    const selected = freezes.find(x => x.selectedForBacktest) || freezes[freezes.length - 1] || null
    const windows = {}
    for (const key of ['T24H','T6H','T1H','T15M']) {
      const rows = odds.filter(x => x.window === key)
      windows[key] = { captured: rows.length > 0, markets: rows.length, at: rows[0]?.capturedAt || null, minutesBeforeKickoff: rows[0]?.minutesBeforeKickoff ?? null }
    }
    return json(200, {
      ok: true, available: freezes.length > 0 || odds.length > 0,
      fixtureId, fixture: snapshotQ.data ? { fixtureDate:snapshotQ.data.fixture_date, homeTeam:snapshotQ.data.home_team, awayTeam:snapshotQ.data.away_team, league:snapshotQ.data.league, country:snapshotQ.data.country, score: snapshotQ.data.actual_home_goals == null ? null : { home:snapshotQ.data.actual_home_goals, away:snapshotQ.data.actual_away_goals }, settlementStatus:snapshotQ.data.settlement_status || null } : null,
      reproducibility: { freezeCaptures: freezes.length, verifiedHashes: verified, verifiableHashes: verifiable, legacyHashes: legacy, verificationRate: verifiable ? Math.round(verified / verifiable * 100) : null, selectedHash: selected?.freezeHash || null, selectedModelVersion: selected?.modelVersion || null },
      windows, freezes, odds, events
    })
  } catch (error) {
    return json(500, { ok: false, error: error?.message || String(error) })
  }
}

exports._test = { verifyFreeze, compactFreeze }
