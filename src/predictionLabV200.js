import {
  buildChallengerRawV180,
  chooseActiveModelV173,
  buildModelLabV180,
  adaptiveCalibrateTripletV172,
  adaptiveCalibrateBinaryV172
} from './predictionLabV180'
import { dixonColesForecastV163 } from './predictionLabV166'

export { buildChallengerRawV180, chooseActiveModelV173, adaptiveCalibrateTripletV172, adaptiveCalibrateBinaryV172 }

const clamp = (value, min, max, fallback = 0) => {
  const n = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback))
}
const round1 = v => Math.round(Number(v || 0) * 10) / 10
const round2 = v => Math.round(Number(v || 0) * 100) / 100
const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

function normalizeTriplet(value = {}) {
  const h = clamp(value?.home, 0.01, 99.98, 33.4)
  const d = clamp(value?.draw, 0.01, 99.98, 33.3)
  const a = clamp(value?.away, 0.01, 99.98, 33.3)
  const s = h + d + a
  return { home: h * 100 / s, draw: d * 100 / s, away: a * 100 / s }
}

function seasonKey(dateLike = '') {
  const d = new Date(dateLike)
  if (!Number.isFinite(d.getTime())) return 'UNKNOWN'
  const y = d.getUTCFullYear()
  const start = d.getUTCMonth() >= 6 ? y : y - 1
  return `${start}/${String(start + 1).slice(-2)}`
}

function findCalibrationProfile(performance = null, league = '', market = '') {
  const ds = performance?.dataScience || {}
  const leagueRow = (ds?.calibration?.leagueProfiles || []).find(row => norm(row?.league) === norm(league))
  return leagueRow?.markets?.find(row => row?.key === market) || (ds?.calibration?.marketProfiles || []).find(row => row?.key === market) || null
}

function platt(probability, params = {}) {
  const p = clamp(Number(probability) / 100, .005, .995, .5)
  const x = Math.log(p / (1 - p))
  const a = clamp(params?.a, .25, 2.5, 1)
  const b = clamp(params?.b, -2, 2, 0)
  return 100 / (1 + Math.exp(-(a * x + b)))
}

function isotonic(probability, points = []) {
  const p = clamp(probability, 0.5, 99.5, 50)
  const rows = (Array.isArray(points) ? points : []).filter(row => Number.isFinite(Number(row?.x)) && Number.isFinite(Number(row?.y))).sort((a, b) => Number(a.x) - Number(b.x))
  if (!rows.length) return p
  if (p <= rows[0].x) return Number(rows[0].y)
  if (p >= rows[rows.length - 1].x) return Number(rows[rows.length - 1].y)
  for (let i = 1; i < rows.length; i += 1) {
    if (p > rows[i].x) continue
    const lo = rows[i - 1], hi = rows[i]
    const span = Math.max(.001, Number(hi.x) - Number(lo.x))
    const t = (p - Number(lo.x)) / span
    return Number(lo.y) + (Number(hi.y) - Number(lo.y)) * t
  }
  return p
}


function stackingProfile(performance = null, market = '') {
  return performance?.dataScience?.stacking?.[market] || []
}

export function applyEnsembleStackingV197(performance = null, challenger = null, market = '', fallback = null) {
  if (!challenger || performance?.dataScience?.autoSelection?.winner !== 'CALIBRATED_STACK') return { value: fallback, applied: false, sources: 0 }
  const profile = stackingProfile(performance, market)
  if (!Array.isArray(profile) || profile.length < 2) return { value: fallback, applied: false, sources: 0 }
  const rows = []
  for (const item of profile) {
    const source = challenger?.components?.[item?.source]
    const w = Number(item?.weight || 0)
    if (!source || !(w > 0)) continue
    if (market === 'oneXTwo' && source?.oneXTwo) rows.push({ value: normalizeTriplet(source.oneXTwo), weight: w, source:item.source })
    if (market !== 'oneXTwo' && Number.isFinite(Number(source?.goals?.[market]))) rows.push({ value: Number(source.goals[market]), weight: w, source:item.source })
  }
  if (rows.length < 2) return { value:fallback, applied:false, sources:rows.length }
  const total=rows.reduce((a,b)=>a+b.weight,0)
  if (market === 'oneXTwo') {
    const stacked=normalizeTriplet({
      home:rows.reduce((a,b)=>a+b.value.home*b.weight,0)/total,
      draw:rows.reduce((a,b)=>a+b.value.draw*b.weight,0)/total,
      away:rows.reduce((a,b)=>a+b.value.away*b.weight,0)/total
    })
    const base=normalizeTriplet(fallback||stacked), blend=.35
    const value=normalizeTriplet({home:base.home*(1-blend)+stacked.home*blend,draw:base.draw*(1-blend)+stacked.draw*blend,away:base.away*(1-blend)+stacked.away*blend})
    return { value:{home:round1(value.home),draw:round1(value.draw),away:round1(value.away)}, applied:true, sources:rows.length, blendPct:35 }
  }
  const stacked=rows.reduce((a,b)=>a+b.value*b.weight,0)/total, base=Number(fallback), blend=.35
  return { value:round1(clamp((Number.isFinite(base)?base:stacked)*(1-blend)+stacked*blend,1,99,stacked)), applied:true, sources:rows.length, blendPct:35 }
}

export function applyDataScienceBinaryV200(performance = null, league = '', market = '', probability = 50) {
  const profile = findCalibrationProfile(performance, league, market)
  const raw = clamp(probability, 1, 99, 50)
  if (!profile || Number(profile?.samples || 0) < 60) return { calibrated: round1(raw), applied: false, method: 'RAW', profile }
  const method = String(profile?.selectedMethod || 'RAW').toUpperCase()
  let calibrated = raw
  if (method === 'PLATT') calibrated = platt(raw, profile?.parameters || {})
  else if (method === 'ISOTONIC') calibrated = isotonic(raw, profile?.parameters?.points || [])
  const shrink = clamp(Number(profile?.hierarchicalShrink || 1), .2, 1, 1)
  calibrated = raw + (calibrated - raw) * shrink
  return { calibrated: round1(clamp(calibrated, 1, 99, raw)), applied: method !== 'RAW' && Math.abs(calibrated - raw) >= .2, method, profile }
}

export function applyDataScienceTripletV200(performance = null, league = '', triplet = null) {
  const raw = normalizeTriplet(triplet || {})
  const profile = findCalibrationProfile(performance, league, 'oneXTwo')
  if (!profile || Number(profile?.samples || 0) < 80) return { calibrated: { home: round1(raw.home), draw: round1(raw.draw), away: round1(raw.away) }, applied: false, method: 'RAW', profile }
  const method = String(profile?.selectedMethod || 'RAW').toUpperCase()
  if (method !== 'TEMPERATURE') return { calibrated: { home: round1(raw.home), draw: round1(raw.draw), away: round1(raw.away) }, applied: false, method, profile }
  const temperature = clamp(profile?.parameters?.temperature, .65, 1.6, 1)
  const shrink = clamp(Number(profile?.hierarchicalShrink || 1), .2, 1, 1)
  const vals = [raw.home, raw.draw, raw.away].map(v => Math.pow(Math.max(.0001, v / 100), 1 / temperature))
  const sum = vals.reduce((a, b) => a + b, 0)
  const target = { home: vals[0] * 100 / sum, draw: vals[1] * 100 / sum, away: vals[2] * 100 / sum }
  const blended = normalizeTriplet({
    home: raw.home + (target.home - raw.home) * shrink,
    draw: raw.draw + (target.draw - raw.draw) * shrink,
    away: raw.away + (target.away - raw.away) * shrink
  })
  return { calibrated: { home: round1(blended.home), draw: round1(blended.draw), away: round1(blended.away) }, applied: Math.abs(temperature - 1) >= .02, method, profile }
}

function modelStability(forecast = {}) {
  const champion = forecast?.modelVariants?.champion || {}
  const challenger = forecast?.modelVariants?.challenger || {}
  const diffs = []
  for (const key of ['home', 'draw', 'away']) {
    const a = Number(champion?.oneXTwo?.[key]), b = Number(challenger?.oneXTwo?.[key])
    if (Number.isFinite(a) && Number.isFinite(b)) diffs.push(Math.abs(a - b))
  }
  for (const key of ['over15', 'over25', 'over35', 'btts']) {
    const a = Number(champion?.goals?.[key]), b = Number(challenger?.goals?.[key])
    if (Number.isFinite(a) && Number.isFinite(b)) diffs.push(Math.abs(a - b))
  }
  const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 8
  const maxDiff = diffs.length ? Math.max(...diffs) : 12
  const xg = forecast?.modelVariants?.challenger?.xg || forecast?.xg || null
  let sensitivity = 0
  if (xg && Number.isFinite(Number(xg.home)) && Number.isFinite(Number(xg.away))) {
    const base = dixonColesForecastV163(Number(xg.home), Number(xg.away), -0.08)
    const up = dixonColesForecastV163(Number(xg.home) + .06, Math.max(.12, Number(xg.away) - .06), -0.08)
    sensitivity = Math.max(...['home','draw','away'].map(key => Math.abs(Number(base?.oneXTwo?.[key] || 0) - Number(up?.oneXTwo?.[key] || 0))))
  }
  const score = Math.round(clamp(100 - avgDiff * 3.1 - Math.max(0, maxDiff - 10) * 1.5 - sensitivity * 2.2, 0, 100, 50))
  return { score, label: score >= 82 ? 'HIGH' : score >= 65 ? 'GOOD' : score >= 48 ? 'WATCH' : 'LOW', avgModelDeltaPp: round1(avgDiff), maxModelDeltaPp: round1(maxDiff), xgPerturbationMaxPp: round1(sensitivity) }
}

function fixtureIntegrity(match = {}, data = {}, forecast = {}) {
  const fixtureId = String(forecast?.fixtureId || match?.apiFixtureId || match?.id || data?.fixture?.id || '')
  const home = String(data?.fixture?.home?.name || match?.home || '').trim()
  const away = String(data?.fixture?.away?.name || match?.away || '').trim()
  const kickoffRaw = data?.fixture?.date || match?.rawDate || match?.date || ''
  const kickoffMs = Date.parse(kickoffRaw)
  const generatedMs = Date.parse(forecast?.generatedAt || '')
  const now = Date.now()
  const issues = []
  if (!fixtureId) issues.push('missing_fixture_id')
  if (!home || !away || norm(home) === norm(away)) issues.push('invalid_teams')
  if (!Number.isFinite(kickoffMs)) issues.push('invalid_kickoff')
  if (Number.isFinite(generatedMs) && Number.isFinite(kickoffMs) && generatedMs >= kickoffMs) issues.push('prediction_generated_after_kickoff')
  if (Number.isFinite(generatedMs) && generatedMs > now + 2 * 60 * 1000) issues.push('future_generated_at')
  return { fixtureId, home, away, kickoffAt: Number.isFinite(kickoffMs) ? new Date(kickoffMs).toISOString() : null, season: seasonKey(kickoffRaw), clear: issues.length === 0, issues }
}

export function buildReliabilityGuardV190({ match = {}, data = {}, forecast = null, performance = null, oddsHistory = null } = {}) {
  const integrity = fixtureIntegrity(match, data, forecast || {})
  const stability = modelStability(forecast || {})
  const quality = Number(forecast?.dataQuality || 0)
  const overfit = performance?.dataScience?.overfittingGuard || { level: 'PENDING', score: 50 }
  const backendIntegrity = performance?.integrityControl || null
  const ds = performance?.dataScience || null
  const reasons = []
  let status = 'ALLOW'

  if (!integrity.clear) { status = 'NO_PREDICTION'; reasons.push(`Anti-Leakage/Fixture Guard: ${integrity.issues.join(', ')}`) }
  if (quality < 50) { status = 'NO_PREDICTION'; reasons.push(`Data Quality ${quality}/100 < 50`) }
  if (stability.score < 35) { status = 'NO_PREDICTION'; reasons.push(`Probability Stability ${stability.score}/100`) }
  if (String(backendIntegrity?.health || '').toUpperCase() === 'CRITICAL') { status = 'NO_PREDICTION'; reasons.push('Reliability Control Center ma status CRITICAL') }
  if (status !== 'NO_PREDICTION') {
    if (quality < 65 || stability.score < 60 || String(overfit?.level || '').toUpperCase() === 'HIGH') status = 'WATCH'
    if (quality < 65) reasons.push(`Data Quality ${quality}/100`)
    if (stability.score < 60) reasons.push(`Stability ${stability.score}/100`)
    if (String(overfit?.level || '').toUpperCase() === 'HIGH') reasons.push('Overfitting Guard: HIGH')
  }

  const oddsRows = Array.isArray(oddsHistory?.markets) ? oddsHistory.markets : []
  const nearKickoff = oddsRows.filter(row => row?.nearKickoff).length
  return {
    version: 'BETAI_RELIABILITY_DATA_INTEGRITY_V190',
    modules: ['V181_ANTI_DATA_LEAKAGE','V182_PREDICTION_FREEZE','V183_FIXTURE_INTEGRITY','V184_SEASON_BOUNDARY','V185_CLV_2','V186_OVERFITTING_GUARD','V187_PROBABILITY_STABILITY','V188_ABSTENTION_ENGINE','V189_DECISION_QUALITY','V190_RELIABILITY_CONTROL_CENTER'],
    status,
    abstention: { abstain: status === 'NO_PREDICTION', status, reasons, reason: reasons[0] || 'Wszystkie krytyczne kontrole przeszły.' },
    integrity,
    stability,
    overfitting: overfit,
    backendIntegrity,
    clv2: { capturedMarkets: oddsRows.length, nearKickoffMarkets: nearKickoff, label: nearKickoff ? 'CLOSING PROXY AVAILABLE' : 'WAITING FOR NEAR-KICKOFF QUOTE', note: 'Closing proxy to ostatni zapisany kurs przed kickoffem; nie jest deklarowany jako pełny bookmaker close bez zapisu blisko startu.' },
    dataScience: ds ? { version: ds.version, autoSelection: ds.autoSelection || null, bootstrap: ds.bootstrap || null } : null
  }
}

export function applyReliabilityDecisionV190(professionalLab = null, guard = null) {
  if (!professionalLab || !guard) return professionalLab
  const card = { ...(professionalLab?.decisionCard || {}) }
  if (guard?.status === 'NO_PREDICTION') {
    card.decision = 'NO_BET'
    card.abstention = true
    card.reason = `NO PREDICTION: ${guard?.abstention?.reason || 'kontrola integralności nie przeszła.'}`
  } else if (guard?.status === 'WATCH' && card.decision === 'BET') {
    card.decision = 'WATCH'
    card.abstention = false
    card.reason = `WATCH: Reliability Guard wymaga ostrożności — ${(guard?.abstention?.reasons || []).join(' • ') || 'niestabilność modelu.'}`
  }
  return { ...professionalLab, version: 'BETAI_PRO_LAB_V200', reliabilityGuard: guard, decisionCard: card }
}

export function buildModelLabV200({ match = {}, data = {}, forecast = null, consensus = null, performance = null, oddsHistory = null, challenger = null } = {}) {
  const base = buildModelLabV180({ match, data, forecast, consensus, performance, oddsHistory, challenger }) || {}
  const guard = buildReliabilityGuardV190({ match, data, forecast, performance, oddsHistory })
  return {
    ...base,
    version: 'BETAI_PREDICTION_ENGINE_4_V200',
    modules: [
      ...(base?.modules || []),
      'V181_ANTI_DATA_LEAKAGE','V182_PREDICTION_FREEZE','V183_FIXTURE_INTEGRITY','V184_SEASON_BOUNDARY','V185_ODDS_HISTORY_CLV_2','V186_OVERFITTING_GUARD','V187_PROBABILITY_STABILITY','V188_ABSTENTION_ENGINE','V189_DECISION_QUALITY_LAB','V190_RELIABILITY_CONTROL_CENTER',
      'V191_LOG_LOSS','V192_ISOTONIC_CALIBRATION','V193_PLATT_CALIBRATION','V194_BAYESIAN_LEAGUE_PRIORS','V195_HIERARCHICAL_STRENGTH','V196_SEASON_DECAY','V197_ENSEMBLE_STACKING','V198_OUT_OF_SAMPLE_WALK_FORWARD','V199_BOOTSTRAP_CONFIDENCE','V200_AUTOMATIC_MODEL_SELECTION'
    ],
    reliabilityV190: guard,
    dataScience: performance?.dataScience || null,
    dashboard: {
      ...(base?.dashboard || {}),
      integrityHealth: performance?.integrityControl?.health || 'PENDING',
      probabilityStability: stabilityLabel(guard?.stability?.score),
      abstentionStatus: guard?.status || 'PENDING',
      logLoss: Number(performance?.dataScience?.decisionQuality?.logLoss || 0),
      bootstrapConfidence: performance?.dataScience?.bootstrap?.level || 'PENDING',
      automaticSelection: performance?.dataScience?.autoSelection?.status || 'COLLECTING'
    }
  }
}

function stabilityLabel(score = 0) {
  return Number(score) >= 82 ? 'HIGH' : Number(score) >= 65 ? 'GOOD' : Number(score) >= 48 ? 'WATCH' : 'LOW'
}
