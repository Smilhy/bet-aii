import { dixonColesForecastV163, buildTeamStrengthV164, buildModelLabV166 } from './predictionLabV166'

const clamp = (value, min, max, fallback = 0) => {
  const n = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback))
}
const round1 = value => Math.round(Number(value || 0) * 10) / 10
const round2 = value => Math.round(Number(value || 0) * 100) / 100
const mean = values => {
  const rows = (values || []).map(Number).filter(Number.isFinite)
  return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : 0
}
const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

function normalizeTriplet(percent = {}) {
  const home = clamp(percent?.home, 0, 100)
  const draw = clamp(percent?.draw, 0, 100)
  const away = clamp(percent?.away, 0, 100)
  const sum = home + draw + away
  if (!(sum > 0)) return null
  return { home: home * 100 / sum, draw: draw * 100 / sum, away: away * 100 / sum }
}

function formStrength(rows = []) {
  const sample = (rows || []).slice(0, 8)
  if (!sample.length) return 50
  const points = sample.reduce((sum, row) => sum + (row?.result === 'W' ? 3 : row?.result === 'D' ? 1 : 0), 0)
  return clamp(points / (sample.length * 3) * 100, 0, 100, 50)
}

function formTriplet(data = {}) {
  const h = formStrength(data?.recent?.home)
  const a = formStrength(data?.recent?.away)
  const hGF = mean((data?.recent?.home || []).map(row => row?.gf)) || Number(data?.teamStats?.home?.goalsForAvg || 1.35)
  const hGA = mean((data?.recent?.home || []).map(row => row?.ga)) || Number(data?.teamStats?.home?.goalsAgainstAvg || 1.20)
  const aGF = mean((data?.recent?.away || []).map(row => row?.gf)) || Number(data?.teamStats?.away?.goalsForAvg || 1.15)
  const aGA = mean((data?.recent?.away || []).map(row => row?.ga)) || Number(data?.teamStats?.away?.goalsAgainstAvg || 1.35)
  const strength = (h - a) * 0.52 + ((hGF - hGA) - (aGF - aGA)) * 13 + 6
  const draw = clamp(29 - Math.abs(strength) * 0.1, 18, 31, 26)
  const remaining = 100 - draw
  const homeShare = 1 / (1 + Math.exp(-strength / 16))
  return normalizeTriplet({ home: remaining * homeShare, draw, away: remaining * (1 - homeShare) })
}

function recentBinary(data = {}, key = '') {
  const rows = [...(data?.recent?.home || []), ...(data?.recent?.away || [])]
  let yes = 0
  let count = 0
  for (const row of rows) {
    const gf = Number(row?.gf), ga = Number(row?.ga)
    if (!Number.isFinite(gf) || !Number.isFinite(ga)) continue
    const total = gf + ga
    let hit = false
    if (key === 'over15') hit = total >= 2
    else if (key === 'over25') hit = total >= 3
    else if (key === 'over35') hit = total >= 4
    else if (key === 'btts') hit = gf > 0 && ga > 0
    else continue
    yes += hit ? 1 : 0
    count += 1
  }
  return count ? yes / count * 100 : null
}

function apiTriplet(data = {}) { return normalizeTriplet(data?.prediction?.percent || {}) }
function webTriplet(consensus = null) { return consensus?.consensus?.available ? normalizeTriplet(consensus?.consensus?.percent || {}) : null }

function weightedTriplet(parts = []) {
  const rows = parts.filter(item => item?.value && Number(item?.weight) > 0)
  const total = rows.reduce((sum, item) => sum + Number(item.weight), 0)
  if (!total) return null
  return normalizeTriplet({
    home: rows.reduce((sum, item) => sum + item.value.home * item.weight, 0) / total,
    draw: rows.reduce((sum, item) => sum + item.value.draw * item.weight, 0) / total,
    away: rows.reduce((sum, item) => sum + item.value.away * item.weight, 0) / total
  })
}

function weightedScalar(parts = [], fallback = 50) {
  const rows = parts.filter(item => Number.isFinite(Number(item?.value)) && Number(item?.weight) > 0)
  const total = rows.reduce((sum, item) => sum + Number(item.weight), 0)
  if (!total) return fallback
  return clamp(rows.reduce((sum, item) => sum + Number(item.value) * Number(item.weight), 0) / total, 0.5, 99.5, fallback)
}

function sourceWeight(performance, league, market, source, fallback) {
  const self = performance?.selfLearning || {}
  const leagueKey = norm(league)
  const leagueProfile = (self?.leagueProfiles || []).find(item => norm(item?.league) === leagueKey)
  const marketProfile = leagueProfile?.markets?.find(item => item?.key === market) || self?.marketProfiles?.find(item => item?.key === market)
  const learned = Number(marketProfile?.weights?.[source])
  if (Number.isFinite(learned) && learned > 0) return clamp(learned, 0.15, 2.5, fallback)
  const global = Number(self?.globalWeights?.[source])
  return Number.isFinite(global) && global > 0 ? clamp(global, 0.15, 2.5, fallback) : fallback
}

function fixtureTime(match = {}, data = {}) {
  const raw = data?.fixture?.date || match?.date || match?.kickoff || ''
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : Date.now()
}

function restProfile(rows = [], kickoffMs = Date.now()) {
  const times = (rows || []).map(row => Date.parse(row?.date || '')).filter(Number.isFinite).filter(t => t < kickoffMs).sort((a, b) => b - a)
  if (!times.length) return { matches7d: 0, matches14d: 0, restDays: null, congestion: 'UNKNOWN', penalty: 0 }
  const matches7d = times.filter(t => kickoffMs - t <= 7 * 86400000).length
  const matches14d = times.filter(t => kickoffMs - t <= 14 * 86400000).length
  const restDays = (kickoffMs - times[0]) / 86400000
  let penalty = 0
  if (restDays < 3.2) penalty += 0.07
  else if (restDays < 4.2) penalty += 0.035
  if (matches7d >= 3) penalty += 0.055
  else if (matches7d >= 2) penalty += 0.025
  penalty = clamp(penalty, 0, 0.14, 0)
  return { matches7d, matches14d, restDays: round1(restDays), congestion: penalty >= .09 ? 'HIGH' : penalty >= .04 ? 'MEDIUM' : 'LOW', penalty: round2(penalty) }
}

function lineupProfile(side = {}) {
  const xi = Array.isArray(side?.startXI) ? side.startXI : []
  const byPos = xi.reduce((acc, p) => { const pos = String(p?.pos || '?').toUpperCase(); acc[pos] = (acc[pos] || 0) + 1; return acc }, {})
  return {
    available: xi.length >= 11,
    official: Boolean(side?.official && !side?.predicted),
    predicted: Boolean(side?.predicted),
    confidence: Number(side?.predictionConfidence || 0),
    formation: String(side?.formation || ''),
    players: xi.length,
    positions: byPos,
    goalkeeperKnown: xi.some(p => String(p?.pos || '').toUpperCase() === 'G'),
    names: xi.map(p => String(p?.name || '')).filter(Boolean)
  }
}

function injuryProfile(data = {}, side = 'home') {
  const teamId = String(data?.fixture?.[side]?.id || data?.lineups?.[side]?.teamId || '')
  const all = Array.isArray(data?.injuries?.items) ? data.injuries.items : []
  const items = all.filter(item => !teamId || String(item?.teamId || '') === teamId)
  return {
    count: side === 'home' ? Number(data?.injuries?.homeCount || items.length) : Number(data?.injuries?.awayCount || items.length),
    players: items.map(item => ({ player: String(item?.player || ''), type: String(item?.type || ''), reason: String(item?.reason || '') })).slice(0, 12)
  }
}

export function buildMatchIntelligenceV180({ match = {}, data = {}, performance = null, baseXg = null } = {}) {
  const kickoffMs = fixtureTime(match, data)
  const homeRest = restProfile(data?.recent?.home || [], kickoffMs)
  const awayRest = restProfile(data?.recent?.away || [], kickoffMs)
  const homeXI = lineupProfile(data?.lineups?.home || {})
  const awayXI = lineupProfile(data?.lineups?.away || {})
  const homeInj = injuryProfile(data, 'home')
  const awayInj = injuryProfile(data, 'away')
  const strength = buildTeamStrengthV164({ match, data, performance })

  // Nie wymyślamy indywidualnych ratingów graczy. Wpływ jest liczony tylko z danych,
  // które mamy: liczby absencji, statusu XI, terminarza i team-strength.
  const homeInjuryPenalty = clamp(homeInj.count * 0.028, 0, 0.16, 0)
  const awayInjuryPenalty = clamp(awayInj.count * 0.028, 0, 0.16, 0)
  const homeLineupAdj = homeXI.official ? 0.018 : homeXI.available ? 0 : -0.018
  const awayLineupAdj = awayXI.official ? 0.018 : awayXI.available ? 0 : -0.018
  const strengthAdj = clamp(Number(strength?.ratingDiff || 0) / 2400, -0.12, 0.12, 0)
  const homeXgAdjustment = clamp(-homeInjuryPenalty - Number(homeRest.penalty || 0) + homeLineupAdj + strengthAdj, -0.24, 0.18, 0)
  const awayXgAdjustment = clamp(-awayInjuryPenalty - Number(awayRest.penalty || 0) + awayLineupAdj - strengthAdj, -0.24, 0.18, 0)

  const baseHome = Number(baseXg?.home || 1.35), baseAway = Number(baseXg?.away || 1.10)
  const adjustedXg = { home: round2(clamp(baseHome + homeXgAdjustment, .18, 3.8, baseHome)), away: round2(clamp(baseAway + awayXgAdjustment, .15, 3.6, baseAway)) }
  const confidenceParts = [homeXI.available, awayXI.available, Number.isFinite(homeRest.restDays), Number.isFinite(awayRest.restDays), Boolean(strength?.historical)]
  const dataConfidence = Math.round(40 + confidenceParts.filter(Boolean).length * 11)

  return {
    version: 'BETAI_MATCH_INTELLIGENCE_3_V180',
    modules: ['V175_EXPECTED_LINEUPS','V176_PLAYER_IMPACT_SAFE','V177_GK_DEFENCE_PROXY','V178_FATIGUE_SCHEDULE','V179_INJURY_IMPORTANCE_SAFE','V180_MATCHUP_ADJUSTMENT'],
    dataConfidence: clamp(dataConfidence, 40, 95, 60),
    home: { lineup: homeXI, injuries: homeInj, fatigue: homeRest, teamStrength: strength?.home || null, xgAdjustment: round2(homeXgAdjustment) },
    away: { lineup: awayXI, injuries: awayInj, fatigue: awayRest, teamStrength: strength?.away || null, xgAdjustment: round2(awayXgAdjustment) },
    adjustedXg,
    goalkeeper: {
      home: { knownInXI: homeXI.goalkeeperKnown, rating: null, defenceProxy: Number(strength?.home?.rating || 0) || null },
      away: { knownInXI: awayXI.goalkeeperKnown, rating: null, defenceProxy: Number(strength?.away?.rating || 0) || null },
      note: 'Brak indywidualnego ratingu bramkarza bez wiarygodnego źródła statystyk zawodnika; używany jest wyłącznie team-defence proxy.'
    },
    note: 'Match Intelligence korzysta tylko z już pobranych danych. Nie generuje dodatkowych requestów API-Football.'
  }
}

function componentGoal(web = null, consensus = null, key = '') {
  if (key === 'over25') return consensus?.goals?.available ? Number(consensus?.goals?.over25) : null
  if (key === 'btts') return consensus?.goals?.bttsAvailable ? Number(consensus?.goals?.bttsYes) : null
  return null
}

export function buildChallengerRawV180({ match = {}, data = {}, consensus = null, champion = null, performance = null } = {}) {
  const league = String(data?.fixture?.league || match?.league || '')
  const baseXg = champion?.xg || { home: 1.35, away: 1.10 }
  const intelligence = buildMatchIntelligenceV180({ match, data, performance, baseXg })
  const xg = intelligence.adjustedXg || baseXg
  const poisson = dixonColesForecastV163(Number(xg.home), Number(xg.away), 0)
  const dc = dixonColesForecastV163(Number(xg.home), Number(xg.away), -0.08)
  const form = formTriplet(data)
  const api = apiTriplet(data)
  const web = webTriplet(consensus)
  const strength = buildTeamStrengthV164({ match, data, performance })

  const w1 = source => sourceWeight(performance, league, 'oneXTwo', source, ({ poisson:1.10, dixonColes:1.35, form:.90, api:.70, web:.45, teamStrength: strength.historical ? 1.05 : .45 })[source] || .5)
  const oneXTwo = weightedTriplet([
    { value: poisson.oneXTwo, weight: w1('poisson') },
    { value: dc.oneXTwo, weight: w1('dixonColes') },
    { value: form, weight: w1('form') },
    { value: api, weight: api ? w1('api') : 0 },
    { value: web, weight: web ? w1('web') : 0 },
    { value: strength.oneXTwo, weight: w1('teamStrength') }
  ]) || dc.oneXTwo

  const goals = {}
  for (const key of ['over15','over25','over35','btts']) {
    const recent = recentBinary(data, key)
    const webGoal = componentGoal(web, consensus, key)
    const wd = sourceWeight(performance, league, key, 'dixonColes', 1.45)
    const wp = sourceWeight(performance, league, key, 'poisson', 1.0)
    const wr = sourceWeight(performance, league, key, 'recent', .65)
    const ww = sourceWeight(performance, league, key, 'web', .35)
    goals[key] = round1(weightedScalar([
      { value: dc.goals[key], weight: wd },
      { value: poisson.goals[key], weight: wp },
      { value: recent, weight: wr },
      { value: webGoal, weight: Number.isFinite(webGoal) ? ww : 0 }
    ], dc.goals[key]))
  }

  const components = {
    poisson: { oneXTwo: poisson.oneXTwo, goals: poisson.goals },
    dixonColes: { oneXTwo: dc.oneXTwo, goals: dc.goals },
    form: { oneXTwo: form },
    api: api ? { oneXTwo: api } : null,
    web: web ? { oneXTwo: web, goals: { over25: componentGoal(web, consensus, 'over25'), btts: componentGoal(web, consensus, 'btts') } } : null,
    teamStrength: { oneXTwo: strength.oneXTwo },
    recent: { goals: { over15: recentBinary(data, 'over15'), over25: recentBinary(data, 'over25'), over35: recentBinary(data, 'over35'), btts: recentBinary(data, 'btts') } }
  }

  return {
    version: 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL',
    oneXTwo: { home: round1(oneXTwo.home), draw: round1(oneXTwo.draw), away: round1(oneXTwo.away) },
    goals,
    xg: { home: Number(xg.home), away: Number(xg.away) },
    baseXg: { home: Number(baseXg.home), away: Number(baseXg.away) },
    dixonColes: dc,
    teamStrength: strength,
    matchIntelligence: intelligence,
    components,
    learnedWeights: {
      oneXTwo: Object.fromEntries(['poisson','dixonColes','form','api','web','teamStrength'].map(source => [source, round2(w1(source))])),
      over15: Object.fromEntries(['poisson','dixonColes','recent','web'].map(source => [source, round2(sourceWeight(performance, league, 'over15', source, source === 'dixonColes' ? 1.45 : source === 'poisson' ? 1 : source === 'recent' ? .65 : .35))])),
      over25: Object.fromEntries(['poisson','dixonColes','recent','web'].map(source => [source, round2(sourceWeight(performance, league, 'over25', source, source === 'dixonColes' ? 1.45 : source === 'poisson' ? 1 : source === 'recent' ? .65 : .35))])),
      over35: Object.fromEntries(['poisson','dixonColes','recent','web'].map(source => [source, round2(sourceWeight(performance, league, 'over35', source, source === 'dixonColes' ? 1.45 : source === 'poisson' ? 1 : source === 'recent' ? .65 : .35))])),
      btts: Object.fromEntries(['poisson','dixonColes','recent','web'].map(source => [source, round2(sourceWeight(performance, league, 'btts', source, source === 'dixonColes' ? 1.45 : source === 'poisson' ? 1 : source === 'recent' ? .65 : .35))]))
    },
    sourceCount: Object.values(components).filter(Boolean).length,
    sourceSummary: ['Poisson/xG','Dixon-Coles','Forma',api ? 'API Prediction' : null,web ? 'Web Consensus' : null,strength.historical ? 'Opponent-adjusted Elo' : 'Strength fallback','Recent goals','Match Intelligence'].filter(Boolean)
  }
}

export function chooseActiveModelV173(performance = null) {
  const gov = performance?.selfLearning?.governance || performance?.modelGovernance || null
  const activeVersion = String(gov?.activeVersion || '')
  const challengerActive = activeVersion === 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL'
  return {
    activeModel: challengerActive ? 'challenger' : 'champion',
    activeVersion: challengerActive ? activeVersion : 'BETAI_CHAMPION_V158_CORE',
    status: gov?.status || 'COLLECTING',
    pairedSamples: Number(gov?.pairedSamples || performance?.championChallenger?.pairedSamples || 0),
    reason: gov?.reason || 'V180 zbiera sparowaną historię. Champion pozostaje aktywny do czasu spełnienia progów promocji.',
    previousVersion: gov?.previousVersion || null,
    rollbackArmed: Boolean(gov?.rollbackArmed),
    brierDelta: Number(gov?.brierDelta || 0),
    champion: gov?.champion || performance?.championChallenger?.champion || null,
    challenger: gov?.challenger || performance?.championChallenger?.challenger || null,
    requiredSamples: Number(gov?.requiredSamples || 120)
  }
}

export function buildModelLabV180({ match = {}, data = {}, forecast = null, consensus = null, performance = null, oddsHistory = null, challenger = null } = {}) {
  const base = buildModelLabV166({ match, data, forecast, consensus, performance, oddsHistory, challenger }) || {}
  const self = performance?.selfLearning || {}
  const governance = chooseActiveModelV173(performance)
  const intelligence = challenger?.matchIntelligence || forecast?.modelVariants?.challenger?.matchIntelligence || null
  return {
    ...base,
    version: 'BETAI_PREDICTION_ENGINE_3_V180',
    modules: [
      ...(base?.modules || []),
      'V167_AUTO_WEIGHT_OPTIMIZER','V168_LEAGUE_SPECIFIC_MODELS','V169_MARKET_SPECIFIC_MODELS','V170_RECENCY_LEARNING',
      'V171_FEATURE_PERFORMANCE_LAB','V172_ADAPTIVE_CALIBRATION','V173_AUTO_PROMOTION_ROLLBACK','V174_AI_MODEL_BRAIN_DASHBOARD',
      'V175_EXPECTED_LINEUPS','V176_PLAYER_IMPACT_SAFE','V177_GK_DEFENCE_PROXY','V178_FATIGUE_SCHEDULE','V179_INJURY_IMPORTANCE_SAFE','V180_MATCH_INTELLIGENCE_3'
    ],
    selection: governance,
    selfLearning: {
      version: 'BETAI_SELF_LEARNING_ENGINE_V174',
      globalWeights: self?.globalWeights || null,
      activeLeague: String(data?.fixture?.league || match?.league || ''),
      leagueProfile: (self?.leagueProfiles || []).find(item => norm(item?.league) === norm(data?.fixture?.league || match?.league || '')) || null,
      marketProfiles: self?.marketProfiles || [],
      featureLab: self?.featureLab || [],
      calibration: self?.adaptiveCalibration || null,
      recency: self?.recency || { halfLifeDays: 90 },
      governance
    },
    matchIntelligence: intelligence,
    dashboard: {
      ...(base?.dashboard || {}),
      activeModel: governance.activeModel,
      activeVersion: governance.activeVersion,
      selfLearningSamples: Number(self?.samples || 0),
      learnedSources: Number(self?.featureLab?.length || 0),
      halfLifeDays: Number(self?.recency?.halfLifeDays || 90),
      governanceStatus: governance.status,
      matchIntelConfidence: Number(intelligence?.dataConfidence || 0),
      profileUpdatedAt: self?.profileStorage?.updatedAt || performance?.modelBrain?.profileUpdatedAt || null
    }
  }
}

function calibrationProfile(performance = null, league = '', market = '') {
  const cal = performance?.selfLearning?.adaptiveCalibration || {}
  const leagueRow = (cal?.leagueProfiles || []).find(item => norm(item?.league) === norm(league))
  return leagueRow?.markets?.find(item => item?.key === market) || (cal?.marketProfiles || []).find(item => item?.key === market) || null
}

export function adaptiveCalibrateTripletV172(performance = null, league = '', triplet = null) {
  const normalized = normalizeTriplet(triplet || {})
  if (!normalized) return { calibrated: triplet, applied: false, profile: null }
  const profile = calibrationProfile(performance, league, 'oneXTwo')
  if (!profile || Number(profile.samples || 0) < 30) return { calibrated: normalized, applied: false, profile }
  const power = clamp(profile.power, .72, 1.18, 1)
  const powered = {
    home: Math.pow(normalized.home / 100, power),
    draw: Math.pow(normalized.draw / 100, power),
    away: Math.pow(normalized.away / 100, power)
  }
  const calibrated = normalizeTriplet(powered)
  return { calibrated: { home: round1(calibrated.home), draw: round1(calibrated.draw), away: round1(calibrated.away) }, applied: Math.abs(power - 1) >= .01, profile }
}

export function adaptiveCalibrateBinaryV172(performance = null, league = '', market = '', probability = 50) {
  const profile = calibrationProfile(performance, league, market)
  if (!profile || Number(profile.samples || 0) < 30) return { calibrated: round1(probability), applied: false, profile }
  const bias = clamp(profile.biasPp, -8, 8, 0)
  return { calibrated: round1(clamp(Number(probability) + bias, 1, 99, probability)), applied: Math.abs(bias) >= .2, profile }
}
