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
    modelVersion: clean(forecast?.version || 'BETAI_FORECAST_V166', 80),
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
    model_version: clean(forecast?.version || 'BETAI_FORECAST_V166', 80),
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
      model_version: clean(variant?.version || (role === 'champion' ? 'BETAI_CHAMPION_V158_CORE' : 'BETAI_CHALLENGER_V166_DC_STRENGTH'), 100),
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

  // WERSJA 137: prognoza jest pre-match. Po kickoffie snapshot jest zamrożony
  // i nigdy nie jest nadpisywany danymi, które mogły już znać przebieg meczu.
  const kickoffRaw = existing?.fixture_date || body.fixtureDate || ''
  const kickoffMs = Date.parse(kickoffRaw)
  const afterKickoff = Number.isFinite(kickoffMs) && Date.now() >= kickoffMs
  if (existing?.settled_at || afterKickoff) {
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

  if (existing && Number(existing.data_quality || 0) > newQuality) {
    try { await captureOddsHistory(supabase, fixtureId, body.fixtureDate || existing.fixture_date || null, forecast) } catch (_) {}
    let oddsHistory = null
    try { oddsHistory = await getOddsHistorySummary(supabase, fixtureId, body.fixtureDate || existing.fixture_date || null) } catch (_) {}
    let audit = null
    try { audit = await capturePredictionAuditV153(supabase, fixtureId, body.fixtureDate || existing.fixture_date || null, body, forecast) } catch (_) {}
    return json(200, { ok: true, saved: false, reused: true, reason: 'existing_snapshot_has_higher_quality', dataQuality: existing.data_quality, oddsHistory, audit })
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

  return json(200, { ok: true, saved: true, reused: false, fixtureId, dataQuality: newQuality, oddsHistory, shadowBet, audit, modelExperiments })
}
