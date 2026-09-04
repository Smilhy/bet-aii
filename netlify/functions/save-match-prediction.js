const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

function clean(value, max = 300) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}

async function captureOddsHistory(supabase, fixtureId, fixtureDate, forecast) {
  const rows = Array.isArray(forecast?.value?.top3) ? forecast.value.top3 : []
  if (!rows.length) return
  const now = new Date()
  for (const item of rows) {
    const marketKey = clean(item?.key, 50)
    const bookmaker = clean(item?.bookmaker || 'Bookmaker', 120)
    const odds = Number(item?.bookmakerOdds || 0)
    if (!marketKey || !(odds > 1)) continue

    // Do not spam history when the exact same quote is saved repeatedly.
    const { data: last } = await supabase
      .from('match_odds_history')
      .select('odds,captured_at')
      .eq('fixture_id', fixtureId)
      .eq('market_key', marketKey)
      .eq('bookmaker', bookmaker)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastMs = Date.parse(last?.captured_at || '')
    if (last && Math.abs(Number(last.odds || 0) - odds) < 0.005 && Number.isFinite(lastMs) && now.getTime() - lastMs < 10 * 60 * 1000) continue

    await supabase.from('match_odds_history').insert({
      fixture_id: fixtureId,
      fixture_date: fixtureDate || null,
      market_key: marketKey,
      bookmaker,
      odds,
      model_probability: Number(item?.probability || 0),
      fair_odds: Number(item?.fairOdds || 0),
      edge_pp: Number(item?.edgePp || 0),
      expected_value_pct: Number(item?.expectedValuePct || 0),
      captured_at: now.toISOString()
    })
  }
}

async function getOddsHistorySummary(supabase, fixtureId, fixtureDate) {
  const { data, error } = await supabase
    .from('match_odds_history')
    .select('market_key,bookmaker,odds,model_probability,fair_odds,edge_pp,expected_value_pct,captured_at')
    .eq('fixture_id', fixtureId)
    .order('captured_at', { ascending: true })
    .limit(200)
  if (error || !Array.isArray(data)) return null
  const kickoffMs = Date.parse(fixtureDate || '')
  const grouped = {}
  for (const row of data) {
    const key = `${row.market_key}|${row.bookmaker}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(row)
  }
  const markets = Object.values(grouped).map(rows => {
    const first = rows[0]
    const latest = rows[rows.length - 1]
    const latestMs = Date.parse(latest?.captured_at || '')
    const nearKickoff = Number.isFinite(kickoffMs) && Number.isFinite(latestMs) && kickoffMs - latestMs <= 20 * 60 * 1000 && kickoffMs - latestMs >= -5 * 60 * 1000
    const clvPct = nearKickoff && Number(latest?.odds) > 1 && Number(first?.odds) > 1
      ? ((Number(first.odds) / Number(latest.odds)) - 1) * 100
      : null
    return {
      marketKey: first.market_key,
      bookmaker: first.bookmaker,
      openOdds: Number(first.odds),
      latestOdds: Number(latest.odds),
      snapshots: rows.length,
      nearKickoff,
      clvPct: clvPct == null ? null : Math.round(clvPct * 10) / 10,
      latestAt: latest.captured_at
    }
  })
  return { fixtureId, markets }
}


async function captureShadowBetV151(supabase, fixtureId, fixtureDate, body = {}, forecast = {}) {
  const card = forecast?.professionalLab?.decisionCard || null
  if (!card || String(card?.decision || '').toUpperCase() !== 'BET') return { captured: false, reason: 'not_a_bet' }
  const marketKey = clean(card?.key, 50)
  const bookmaker = clean(card?.bookmaker || 'Bookmaker', 120)
  const odds = Number(card?.bookmakerOdds || 0)
  if (!marketKey || !(odds > 1)) return { captured: false, reason: 'missing_market_or_odds' }
  const row = {
    fixture_id: String(fixtureId),
    fixture_date: fixtureDate || null,
    home_team: clean(body?.homeTeam, 180),
    away_team: clean(body?.awayTeam, 180),
    league: clean(body?.league, 180),
    country: clean(body?.country, 120),
    market_key: marketKey,
    market_label: clean(card?.label || marketKey, 120),
    bookmaker,
    odds,
    model_version: clean(forecast?.version || 'BETAI_FORECAST_V152', 80),
    raw_probability: Number(card?.rawProbability || 0),
    calibrated_probability: Number(card?.calibratedProbability || 0),
    uncertainty_pp: Number(card?.uncertaintyPp || 0),
    conservative_probability: Number(card?.conservativeProbability || 0),
    fair_odds: Number(card?.fairOdds || 0),
    no_vig_probability: Number(card?.noVigProbability || 0),
    edge_pp: Number(card?.conservativeEdgePp || 0),
    expected_value_pct: Number(card?.expectedValuePct || 0),
    reliability: Math.round(Number(card?.reliability || 0)),
    league_trust: Math.round(Number(card?.leagueTrust || 0)),
    drift_status: clean(card?.driftStatus || 'PENDING', 40),
    stake_units: Math.max(0.01, Number(card?.stakeUnits || 1)),
    decision: 'BET',
    status: 'pending'
  }
  const { error } = await supabase
    .from('match_shadow_bets')
    .upsert(row, { onConflict: 'fixture_id,market_key,bookmaker,model_version', ignoreDuplicates: true })
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return { captured: false, reason: 'table_missing' }
    throw error
  }
  return { captured: true, marketKey, bookmaker }
}



async function capturePredictionAuditV153(supabase, fixtureId, fixtureDate, body = {}, forecast = {}) {
  const compact = {
    modelVersion: clean(forecast?.version || 'BETAI_FORECAST_V180', 80),
    generatedAt: forecast?.generatedAt || null,
    dataQuality: Number(forecast?.dataQuality || 0),
    xg: forecast?.xg || null,
    raw: forecast?.raw || null,
    calibrated: { oneXTwo: forecast?.oneXTwo || null, goals: forecast?.goals || null },
    sourceWeights: forecast?.sourceWeights || null,
    ensembleValidation: forecast?.ensembleValidation || null,
    reliability: forecast?.reliability || null,
    professionalLab: forecast?.professionalLab || null,
    modelLab: forecast?.modelLab || null,
    modelVariants: forecast?.modelVariants || null,
    marketValidation: forecast?.marketValidation || null,
    valueTop3: Array.isArray(forecast?.value?.top3) ? forecast.value.top3.slice(0, 3) : [],
    consensus: forecast?.consensus || null,
    factors: Array.isArray(forecast?.factors) ? forecast.factors.slice(0, 12) : [],
    modelInputs: forecast?.modelInputs || null
  }
  const hashInput = JSON.stringify({ fixtureId, compact })
  const auditHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 40)
  const row = {
    fixture_id: String(fixtureId),
    fixture_date: fixtureDate || null,
    home_team: clean(body?.homeTeam, 180),
    away_team: clean(body?.awayTeam, 180),
    league: clean(body?.league, 180),
    country: clean(body?.country, 120),
    model_version: clean(forecast?.version || 'BETAI_FORECAST_V180', 80),
    audit_hash: auditHash,
    data_quality: Math.max(0, Math.min(100, Math.round(Number(forecast?.dataQuality || 0)))),
    decision: clean(forecast?.professionalLab?.decisionCard?.decision || forecast?.value?.state || '', 40),
    market_key: clean(forecast?.professionalLab?.decisionCard?.key || forecast?.value?.top?.key || '', 60),
    payload: compact
  }
  const { error } = await supabase
    .from('match_prediction_audit')
    .upsert(row, { onConflict: 'fixture_id,audit_hash', ignoreDuplicates: true })
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return { captured: false, reason: 'table_missing' }
    throw error
  }
  return { captured: true, auditHash }
}


async function captureModelExperimentsV160(supabase, fixtureId, fixtureDate, body = {}, forecast = {}) {
  const variants = forecast?.modelVariants || {}
  const rows = []
  const add = (role, variant) => {
    if (!variant || typeof variant !== 'object') return
    rows.push({
      fixture_id: String(fixtureId),
      fixture_date: fixtureDate || null,
      home_team: clean(body?.homeTeam, 180),
      away_team: clean(body?.awayTeam, 180),
      league: clean(body?.league, 180),
      country: clean(body?.country, 120),
      model_role: role,
      model_version: clean(variant?.version || (role === 'champion' ? 'BETAI_CHAMPION_V158_CORE' : 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL'), 100),
      active_at_capture: String(forecast?.activeModel || 'champion') === role,
      data_quality: Math.max(0, Math.min(100, Math.round(Number(forecast?.dataQuality || 0)))),
      forecast: variant,
      status: 'pending',
      updated_at: new Date().toISOString()
    })
  }
  add('champion', variants?.champion)
  add('challenger', variants?.challenger)
  if (!rows.length) return { captured: false, reason: 'no_variants' }
  const { error } = await supabase
    .from('match_model_experiments')
    .upsert(rows, { onConflict: 'fixture_id,model_role,model_version' })
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return { captured: false, reason: 'table_missing' }
    throw error
  }
  return { captured: true, rows: rows.length }
}



function normIdentityV183(value = '') {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}
function shaV182(value = '') { return crypto.createHash('sha256').update(String(value)).digest('hex') }
function stableStringifyV211(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringifyV211).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringifyV211(value[key])}`).join(',')}}`
}
function seasonKeyV184(dateLike = '') {
  const d = new Date(dateLike); if (!Number.isFinite(d.getTime())) return null
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 6 ? y : y - 1
  return `${start}/${String(start + 1).slice(-2)}`
}
async function integrityEventV183(supabase, fixtureId, eventType, severity = 'info', detail = {}) {
  try { await supabase.from('match_integrity_events').insert({ fixture_id:String(fixtureId), event_type:eventType, severity, detail, created_at:new Date().toISOString() }) } catch (_) {}
}
async function assessFixtureIntegrityV183(supabase, fixtureId, body = {}, forecast = {}, existing = null) {
  const kickoff = body.fixtureDate || existing?.fixture_date || null
  const kickoffMs = Date.parse(kickoff || '')
  const generatedMs = Date.parse(forecast?.generatedAt || '')
  const now = Date.now()
  const forecastFixtureId = String(forecast?.fixtureId || '')
  const home = clean(body?.homeTeam, 180), away = clean(body?.awayTeam, 180), league = clean(body?.league, 180)
  const issues=[]
  if (forecastFixtureId && forecastFixtureId !== String(fixtureId)) issues.push('forecast_fixture_id_mismatch')
  if (!home || !away || normIdentityV183(home) === normIdentityV183(away)) issues.push('invalid_teams')
  if (!Number.isFinite(kickoffMs)) issues.push('invalid_kickoff')
  if (Number.isFinite(generatedMs) && Number.isFinite(kickoffMs) && generatedMs >= kickoffMs) issues.push('generated_after_kickoff')
  if (Number.isFinite(generatedMs) && generatedMs > now + 2 * 60 * 1000) issues.push('generated_in_future')
  const duplicateKey = shaV182(`${normIdentityV183(league)}|${normIdentityV183(home)}|${normIdentityV183(away)}|${kickoff || ''}`).slice(0,40)
  let duplicateFixtureId = null
  try {
    const { data } = await supabase.from('match_fixture_integrity').select('fixture_id').eq('duplicate_key', duplicateKey).neq('fixture_id', String(fixtureId)).limit(1).maybeSingle()
    duplicateFixtureId = data?.fixture_id ? String(data.fixture_id) : null
  } catch (_) {}
  if (duplicateFixtureId) issues.push('duplicate_fixture')
  return { clear:issues.length===0,issues,duplicateKey,duplicateFixtureId,kickoff,kickoffMs,generatedAt:Number.isFinite(generatedMs)?new Date(generatedMs).toISOString():null,seasonKey:seasonKeyV184(kickoff) }
}
async function persistFixtureIntegrityV183(supabase, fixtureId, body = {}, assessment = {}, current = {}) {
  try {
    const now=new Date().toISOString()
    const row={
      fixture_id:String(fixtureId), canonical_fixture_date:assessment.kickoff||null,
      home_team:clean(body?.homeTeam,180), away_team:clean(body?.awayTeam,180), league:clean(body?.league,180), country:clean(body?.country,120),
      duplicate_key:assessment.duplicateKey||null, season_key:assessment.seasonKey||null,
      integrity_status:assessment.clear?'clear':'review', leakage_status:assessment.issues?.some(x=>x.includes('generated_')||x.includes('fixture_id_mismatch'))?'blocked':'clear',
      freeze_count:Math.max(0,Number(current?.freeze_count||0)), settlement_count:Math.max(0,Number(current?.settlement_count||0)),
      metadata:{issues:assessment.issues||[],duplicateFixtureId:assessment.duplicateFixtureId||null}, first_seen_at:current?.first_seen_at||now,last_seen_at:now,updated_at:now
    }
    await supabase.from('match_fixture_integrity').upsert(row,{onConflict:'fixture_id'})
  } catch (_) {}
}
async function captureFreezeLedgerV182(supabase, fixtureId, body = {}, forecast = {}, assessment = {}, selectedForBacktest = false, reason = '') {
  const capturedAt=new Date().toISOString()
  const payload={fixtureId:String(fixtureId),fixtureDate:assessment.kickoff||body.fixtureDate||null,homeTeam:clean(body?.homeTeam,180),awayTeam:clean(body?.awayTeam,180),league:clean(body?.league,180),country:clean(body?.country,120),forecast}
  const freezeHash=shaV182(JSON.stringify(payload))
  const canonicalHashV211=shaV182(stableStringifyV211(payload))
  const row={
    fixture_id:String(fixtureId), fixture_date:assessment.kickoff||body.fixtureDate||null,
    home_team:clean(body?.homeTeam,180),away_team:clean(body?.awayTeam,180),league:clean(body?.league,180),country:clean(body?.country,120),season_key:assessment.seasonKey||null,
    captured_at:capturedAt,generated_at:assessment.generatedAt||forecast?.generatedAt||null,input_cutoff_at:capturedAt,
    model_version:clean(forecast?.version||'BETAI_FORECAST_V200',100),active_model:clean(forecast?.activeModel||'champion',40),data_quality:Math.max(0,Math.min(100,Math.round(Number(forecast?.dataQuality||0)))),
    freeze_hash:freezeHash,canonical_hash_v211:canonicalHashV211,selected_for_backtest:Boolean(selectedForBacktest),selection_reason:clean(reason,160),forecast,integrity:{clear:assessment.clear,issues:assessment.issues||[],duplicateKey:assessment.duplicateKey||null},
  }
  const {error}=await supabase.from('match_prediction_freeze_ledger').upsert(row,{onConflict:'freeze_hash',ignoreDuplicates:true})
  if(error){if(/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message||'')))return{captured:false,reason:'table_missing'};throw error}
  try {
    const {data:current}=await supabase.from('match_fixture_integrity').select('freeze_count,first_seen_at,settlement_count').eq('fixture_id',String(fixtureId)).maybeSingle()
    await supabase.from('match_fixture_integrity').update({freeze_count:Number(current?.freeze_count||0)+1,last_seen_at:capturedAt,updated_at:capturedAt}).eq('fixture_id',String(fixtureId))
  } catch (_) {}
  return {captured:true,freezeHash}
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { ok: false, error: 'Nieprawidłowy JSON' }) }

  const fixtureId = clean(body.fixtureId, 100).replace(/[^0-9A-Za-z_-]/g, '')
  const forecast = body.forecast && typeof body.forecast === 'object' ? body.forecast : null
  if (!fixtureId || !forecast) return json(400, { ok: false, error: 'Brak fixtureId lub forecast' })

  const supabase = getClient()
  if (!supabase) return json(503, { ok: false, error: 'Supabase ENV niedostępne' })

  const newQuality = Math.max(0, Math.min(100, Math.round(Number(forecast.dataQuality) || 0)))
  const { data: existing, error: readError } = await supabase
    .from('match_prediction_snapshots')
    .select('fixture_id,fixture_date,data_quality,forecast,updated_at,settled_at')
    .eq('fixture_id', fixtureId)
    .maybeSingle()

  if (readError && readError.code !== 'PGRST116' && !String(readError.message || '').toLowerCase().includes('no rows')) {
    return json(500, { ok: false, error: readError.message })
  }

  // V181–V184: integralność jest oceniana przed jakimkolwiek zapisem do historii modelu.
  const assessment = await assessFixtureIntegrityV183(supabase, fixtureId, body, forecast, existing)
  let integrityCurrent = null
  try { const { data } = await supabase.from('match_fixture_integrity').select('freeze_count,settlement_count,first_seen_at').eq('fixture_id', fixtureId).maybeSingle(); integrityCurrent = data || null } catch (_) {}
  await persistFixtureIntegrityV183(supabase, fixtureId, body, assessment, integrityCurrent || {})
  if (!assessment.clear) {
    const leakage = assessment.issues.some(x => x === 'generated_after_kickoff' || x === 'generated_in_future' || x === 'forecast_fixture_id_mismatch')
    await integrityEventV183(supabase, fixtureId, leakage ? 'data_leakage_blocked' : assessment.issues.includes('duplicate_fixture') ? 'duplicate_fixture' : 'fixture_integrity_blocked', leakage ? 'critical' : 'warning', assessment)
    return json(200, { ok:true, saved:false, frozen:true, integrityBlocked:true, reason:assessment.issues[0] || 'integrity_blocked', integrity:assessment, dataQuality:Number(existing?.data_quality || newQuality || 0) })
  }

  // V183: jeżeli API przesunęło ten sam fixture na nowy, przyszły termin, stary pre-match
  // snapshot nie może blokować świeżej analizy. Zmiana jest audytowana jako reschedule.
  const existingKickoffMs = Date.parse(existing?.fixture_date || '')
  const requestedKickoffMsV200 = Date.parse(body.fixtureDate || '')
  const rescheduled = Boolean(existing && !existing?.settled_at && Number.isFinite(existingKickoffMs) && Number.isFinite(requestedKickoffMsV200) && requestedKickoffMsV200 > Date.now() && Math.abs(requestedKickoffMsV200 - existingKickoffMs) >= 2 * 60 * 60 * 1000)
  if (rescheduled) await integrityEventV183(supabase, fixtureId, 'fixture_rescheduled', 'info', { from:existing.fixture_date,to:body.fixtureDate })

  // WERSJA 137: prognoza jest pre-match. Po kickoffie snapshot jest zamrożony
  // i nigdy nie jest nadpisywany danymi, które mogły już znać przebieg meczu.
  const kickoffRaw = rescheduled ? (body.fixtureDate || '') : (existing?.fixture_date || body.fixtureDate || '')
  const kickoffMs = Date.parse(kickoffRaw)
  const afterKickoff = Number.isFinite(kickoffMs) && Date.now() >= kickoffMs
  if (existing?.settled_at || (afterKickoff && !rescheduled)) {
    return json(200, {
      ok: true,
      saved: false,
      reused: Boolean(existing),
      frozen: true,
      reason: existing?.settled_at ? 'prediction_already_settled' : 'kickoff_passed_prediction_locked',
      dataQuality: Number(existing?.data_quality || newQuality || 0)
    })
  }

  // Nie tworzymy nowej prognozy po rozpoczęciu meczu nawet wtedy, gdy snapshotu wcześniej nie było.
  const requestedKickoffMs = Date.parse(body.fixtureDate || '')
  if (!existing && Number.isFinite(requestedKickoffMs) && Date.now() >= requestedKickoffMs) {
    return json(200, { ok: true, saved: false, reused: false, frozen: true, reason: 'cannot_create_post_kickoff_snapshot', dataQuality: 0 })
  }

  if (existing && !rescheduled && Number(existing.data_quality || 0) > newQuality) {
    let freezeLedger = null
    try { freezeLedger = await captureFreezeLedgerV182(supabase, fixtureId, body, forecast, assessment, false, 'existing_snapshot_has_higher_quality') } catch (_) {}
    try { await captureOddsHistory(supabase, fixtureId, body.fixtureDate || existing.fixture_date || null, forecast) } catch (_) {}
    let oddsHistory = null
    try { oddsHistory = await getOddsHistorySummary(supabase, fixtureId, body.fixtureDate || existing.fixture_date || null) } catch (_) {}
    let audit = null
    try { audit = await capturePredictionAuditV153(supabase, fixtureId, body.fixtureDate || existing.fixture_date || null, body, forecast) } catch (_) {}
    return json(200, { ok: true, saved: false, reused: true, reason: 'existing_snapshot_has_higher_quality', dataQuality: existing.data_quality, oddsHistory, audit, freezeLedger, integrity:assessment })
  }

  const now = new Date().toISOString()
  const row = {
    fixture_id: fixtureId,
    fixture_date: body.fixtureDate || null,
    home_team: clean(body.homeTeam, 180),
    away_team: clean(body.awayTeam, 180),
    league: clean(body.league, 180),
    country: clean(body.country, 120),
    model_version: clean(forecast.version || 'BETAI_FORECAST_V1', 80),
    data_quality: newQuality,
    source_count: Math.max(0, Math.round(Number(forecast?.consensus?.sourceCount) || 0)),
    consensus_agreement: Math.max(0, Math.min(100, Math.round(Number(forecast?.consensus?.agreement) || 0))),
    forecast,
    consensus: body.consensus && typeof body.consensus === 'object' ? body.consensus : {},
    updated_at: now
  }

  const { error: upsertError } = await supabase
    .from('match_prediction_snapshots')
    .upsert(row, { onConflict: 'fixture_id' })

  if (upsertError) return json(500, { ok: false, error: upsertError.message })

  let freezeLedger = null
  try { freezeLedger = await captureFreezeLedgerV182(supabase, fixtureId, body, forecast, assessment, true, rescheduled ? 'rescheduled_pre_match_snapshot' : 'selected_pre_match_snapshot') } catch (_) {}

  // V142 — store the odds we actually saw with the frozen pre-match forecast.
  // This reuses already-fetched odds; it does not make another API-Football request.
  try { await captureOddsHistory(supabase, fixtureId, body.fixtureDate || null, forecast) } catch (_) {}
  let oddsHistory = null
  try { oddsHistory = await getOddsHistorySummary(supabase, fixtureId, body.fixtureDate || null) } catch (_) {}
  let shadowBet = null
  try { shadowBet = await captureShadowBetV151(supabase, fixtureId, body.fixtureDate || null, body, forecast) } catch (_) {}
  let audit = null
  try { audit = await capturePredictionAuditV153(supabase, fixtureId, body.fixtureDate || null, body, forecast) } catch (_) {}
  let modelExperiments = null
  try { modelExperiments = await captureModelExperimentsV160(supabase, fixtureId, body.fixtureDate || null, body, forecast) } catch (_) {}

  return json(200, { ok: true, saved: true, reused: false, fixtureId, dataQuality: newQuality, oddsHistory, shadowBet, audit, modelExperiments, freezeLedger, integrity:assessment, rescheduled })
}
