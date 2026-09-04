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
const normalizeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż\s-]/gi, ' ').replace(/\s+/g, ' ').trim()

function normalizeTriplet(percent = {}) {
  const home = clamp(percent?.home, 0, 100)
  const draw = clamp(percent?.draw, 0, 100)
  const away = clamp(percent?.away, 0, 100)
  const sum = home + draw + away
  if (!(sum > 0)) return null
  return { home: home * 100 / sum, draw: draw * 100 / sum, away: away * 100 / sum }
}

function poissonP(lambda, goals) {
  let factorial = 1
  for (let i = 2; i <= goals; i += 1) factorial *= i
  return Math.exp(-lambda) * Math.pow(lambda, goals) / factorial
}

function dcTau(homeGoals, awayGoals, homeXg, awayXg, rho) {
  if (homeGoals === 0 && awayGoals === 0) return 1 - (homeXg * awayXg * rho)
  if (homeGoals === 0 && awayGoals === 1) return 1 + (homeXg * rho)
  if (homeGoals === 1 && awayGoals === 0) return 1 + (awayXg * rho)
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho
  return 1
}

export function dixonColesForecastV163(homeXg, awayXg, rho = -0.08) {
  const h = clamp(homeXg, 0.05, 4.5, 1.35)
  const a = clamp(awayXg, 0.05, 4.5, 1.10)
  const r = clamp(rho, -0.18, 0.08, -0.08)
  const maxGoals = 9
  let totalMass = 0
  let home = 0
  let draw = 0
  let away = 0
  let over15 = 0
  let over25 = 0
  let over35 = 0
  let btts = 0
  const scores = []
  for (let hg = 0; hg <= maxGoals; hg += 1) {
    for (let ag = 0; ag <= maxGoals; ag += 1) {
      const base = poissonP(h, hg) * poissonP(a, ag)
      const adjusted = Math.max(0, base * dcTau(hg, ag, h, a, r))
      totalMass += adjusted
      if (hg > ag) home += adjusted
      else if (hg === ag) draw += adjusted
      else away += adjusted
      if (hg + ag >= 2) over15 += adjusted
      if (hg + ag >= 3) over25 += adjusted
      if (hg + ag >= 4) over35 += adjusted
      if (hg > 0 && ag > 0) btts += adjusted
      scores.push({ score: `${hg}:${ag}`, probability: adjusted })
    }
  }
  const scale = totalMass > 0 ? 100 / totalMass : 100
  scores.forEach(item => { item.probability *= scale })
  scores.sort((x, y) => y.probability - x.probability)
  return {
    version: 'BETAI_DIXON_COLES_V163',
    rho: round2(r),
    oneXTwo: normalizeTriplet({ home: home * scale, draw: draw * scale, away: away * scale }),
    goals: {
      over15: round1(over15 * scale),
      over25: round1(over25 * scale),
      over35: round1(over35 * scale),
      btts: round1(btts * scale)
    },
    topScores: scores.slice(0, 5).map(item => ({ score: item.score, probability: round1(item.probability) }))
  }
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
    const gf = Number(row?.gf)
    const ga = Number(row?.ga)
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

function apiTriplet(data = {}) {
  return normalizeTriplet(data?.prediction?.percent || {})
}

function webTriplet(consensus = null) {
  return consensus?.consensus?.available ? normalizeTriplet(consensus?.consensus?.percent || {}) : null
}

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

function lookupTeamRating(performance = null, teamName = '') {
  const target = normalizeName(teamName)
  if (!target) return null
  return (performance?.teamStrength?.teams || []).find(item => normalizeName(item?.team) === target) || null
}

export function buildTeamStrengthV164({ match = {}, data = {}, performance = null } = {}) {
  const homeName = data?.fixture?.home?.name || match?.home || ''
  const awayName = data?.fixture?.away?.name || match?.away || ''
  const homeHistory = lookupTeamRating(performance, homeName)
  const awayHistory = lookupTeamRating(performance, awayName)
  const hForm = formStrength(data?.recent?.home)
  const aForm = formStrength(data?.recent?.away)
  const hRank = Number(data?.standings?.home?.rank || 0)
  const aRank = Number(data?.standings?.away?.rank || 0)
  const fallbackHome = 1500 + (hForm - 50) * 3 + (hRank > 0 ? clamp(42 - (hRank - 1) * 3.2, -45, 42, 0) : 0)
  const fallbackAway = 1500 + (aForm - 50) * 3 + (aRank > 0 ? clamp(42 - (aRank - 1) * 3.2, -45, 42, 0) : 0)
  const homeRating = Number(homeHistory?.rating || fallbackHome)
  const awayRating = Number(awayHistory?.rating || fallbackAway)
  const historical = Boolean(homeHistory && awayHistory && Number(homeHistory?.matches || 0) >= 3 && Number(awayHistory?.matches || 0) >= 3)
  const effectiveDiff = (homeRating + 48) - awayRating
  const homeWinBase = 1 / (1 + Math.pow(10, -effectiveDiff / 400))
  const draw = clamp(27 - Math.abs(effectiveDiff) / 42, 18, 29, 25)
  const remaining = 100 - draw
  const oneXTwo = normalizeTriplet({ home: homeWinBase * remaining, draw, away: (1 - homeWinBase) * remaining })
  const confidence = historical
    ? clamp((Number(homeHistory.matches || 0) + Number(awayHistory.matches || 0)) * 2.4, 45, 92, 60)
    : clamp(42 + ((data?.recent?.home?.length || 0) + (data?.recent?.away?.length || 0)) * 2.2, 45, 70, 55)
  return {
    version: 'BETAI_TEAM_STRENGTH_V164',
    source: historical ? 'OPPONENT-ADJUSTED ELO • BET+AI HISTORY' : 'FORM + TABLE FALLBACK',
    historical,
    confidence: Math.round(confidence),
    home: { team: String(homeName), rating: Math.round(homeRating), samples: Number(homeHistory?.matches || 0), form: Math.round(hForm) },
    away: { team: String(awayName), rating: Math.round(awayRating), samples: Number(awayHistory?.matches || 0), form: Math.round(aForm) },
    ratingDiff: Math.round(effectiveDiff),
    oneXTwo
  }
}

export function buildChallengerRawV166({ match = {}, data = {}, consensus = null, champion = null, performance = null } = {}) {
  const xg = champion?.xg || { home: 1.35, away: 1.10 }
  const dc = dixonColesForecastV163(Number(xg.home), Number(xg.away), -0.08)
  const form = formTriplet(data)
  const api = apiTriplet(data)
  const web = webTriplet(consensus)
  const strength = buildTeamStrengthV164({ match, data, performance })
  const strengthWeight = strength.historical ? 1.15 : 0.55
  const oneXTwo = weightedTriplet([
    { value: dc.oneXTwo, weight: 1.45 },
    { value: form, weight: 0.90 },
    { value: api, weight: api ? 0.70 : 0 },
    { value: web, weight: web ? 0.45 : 0 },
    { value: strength.oneXTwo, weight: strengthWeight }
  ]) || dc.oneXTwo
  const webOver25 = consensus?.goals?.available ? Number(consensus?.goals?.over25) : null
  const webBtts = consensus?.goals?.bttsAvailable ? Number(consensus?.goals?.bttsYes) : null
  const goals = {
    over15: round1(weightedScalar([{ value: dc.goals.over15, weight: 1.5 }, { value: recentBinary(data, 'over15'), weight: .55 }], dc.goals.over15)),
    over25: round1(weightedScalar([{ value: dc.goals.over25, weight: 1.5 }, { value: recentBinary(data, 'over25'), weight: .65 }, { value: webOver25, weight: Number.isFinite(webOver25) ? .35 : 0 }], dc.goals.over25)),
    over35: round1(weightedScalar([{ value: dc.goals.over35, weight: 1.5 }, { value: recentBinary(data, 'over35'), weight: .55 }], dc.goals.over35)),
    btts: round1(weightedScalar([{ value: dc.goals.btts, weight: 1.5 }, { value: recentBinary(data, 'btts'), weight: .65 }, { value: webBtts, weight: Number.isFinite(webBtts) ? .30 : 0 }], dc.goals.btts))
  }
  return {
    version: 'BETAI_CHALLENGER_V166_DC_STRENGTH',
    oneXTwo: { home: round1(oneXTwo.home), draw: round1(oneXTwo.draw), away: round1(oneXTwo.away) },
    goals,
    xg: { home: Number(xg.home), away: Number(xg.away) },
    dixonColes: dc,
    teamStrength: strength,
    sourceCount: [dc.oneXTwo, form, api, web, strength.oneXTwo].filter(Boolean).length,
    sourceSummary: ['Dixon-Coles', 'Forma', api ? 'API Prediction' : null, web ? 'Web Consensus' : null, strength.historical ? 'Opponent-adjusted Elo' : 'Strength fallback'].filter(Boolean)
  }
}

export function chooseActiveModelV160(performance = null) {
  const lab = performance?.championChallenger || {}
  const promoted = String(lab?.activeModel || '').toLowerCase() === 'challenger' && Number(lab?.pairedSamples || 0) >= 100
  return {
    activeModel: promoted ? 'challenger' : 'champion',
    status: lab?.status || (Number(lab?.pairedSamples || 0) ? 'LEARNING' : 'COLLECTING'),
    pairedSamples: Number(lab?.pairedSamples || 0),
    reason: lab?.reason || (promoted ? 'Challenger spełnił próg promocji i jest aktywnym modelem.' : 'Challenger zbiera rozliczoną historię. Champion pozostaje aktywny do czasu spełnienia progu promocji.'),
    champion: lab?.champion || null,
    challenger: lab?.challenger || null,
    brierDelta: Number(lab?.brierDelta || 0)
  }
}

function probabilityForKey(source = {}, key = '') {
  if (['home', 'draw', 'away'].includes(key)) return Number(source?.oneXTwo?.[key])
  if (key === 'over15') return Number(source?.goals?.over15)
  if (key === 'under15') return 100 - Number(source?.goals?.over15)
  if (key === 'over25') return Number(source?.goals?.over25)
  if (key === 'under25') return 100 - Number(source?.goals?.over25)
  if (key === 'over35') return Number(source?.goals?.over35)
  if (key === 'under35') return 100 - Number(source?.goals?.over35)
  if (key === 'btts' || key === 'bttsYes') return Number(source?.goals?.btts)
  if (key === 'bttsNo') return 100 - Number(source?.goals?.btts)
  return null
}

function labelForKey(key = '') {
  return ({ home: '1 • Gospodarze', draw: 'X • Remis', away: '2 • Goście', over15: 'Over 1.5', under15: 'Under 1.5', over25: 'Over 2.5', under25: 'Under 2.5', over35: 'Over 3.5', under35: 'Under 3.5', btts: 'BTTS TAK', bttsYes: 'BTTS TAK', bttsNo: 'BTTS NIE' })[key] || key
}

export function buildPureModelEnsembleV159({ data = {}, forecast = null, consensus = null, challenger = null } = {}) {
  const candidate = forecast?.value?.top3?.[0] || forecast?.value?.top || null
  if (!candidate?.key) return null
  const key = candidate.key
  const rows = []
  const add = (id, label, probability, weight) => {
    const p = Number(probability)
    if (!Number.isFinite(p) || p <= 0 || p >= 100 || !(weight > 0)) return
    rows.push({ id, label, probability: round1(p), weight })
  }
  const dc = challenger?.dixonColes
  const classicPoisson = dixonColesForecastV163(Number(forecast?.xg?.home || 1.35), Number(forecast?.xg?.away || 1.10), 0)
  const form = formTriplet(data)
  const api = apiTriplet(data)
  const web = webTriplet(consensus)
  add('poisson', 'Poisson / xG', probabilityForKey({ oneXTwo: classicPoisson?.oneXTwo, goals: classicPoisson?.goals }, key), 1.20)
  add('dixon-coles', 'Dixon-Coles', probabilityForKey({ oneXTwo: dc?.oneXTwo, goals: dc?.goals }, key), 1.20)
  if (['home', 'draw', 'away'].includes(key)) add('form', 'Forma + home/away', form?.[key], .90)
  else {
    const recentKey = key.startsWith('under') ? key.replace('under', 'over') : (key === 'bttsYes' || key === 'bttsNo' ? 'btts' : key)
    const recentYes = recentBinary(data, recentKey)
    const recentProbability = recentYes == null ? null : (key.startsWith('under') || key === 'bttsNo' ? 100 - recentYes : recentYes)
    add('recent', 'Ostatnie realne mecze', recentProbability, .85)
  }
  if (['home', 'draw', 'away'].includes(key)) add('api', 'API Prediction', api?.[key], .70)
  add('web', 'Web consensus', ['home', 'draw', 'away'].includes(key) ? web?.[key] : (key === 'over25' ? consensus?.goals?.over25 : key === 'under25' ? consensus?.goals?.under25 : (key === 'btts' || key === 'bttsYes') ? consensus?.goals?.bttsYes : key === 'bttsNo' ? consensus?.goals?.bttsNo : null), .45)
  if (['home', 'draw', 'away'].includes(key)) add('team-strength', 'Team Strength', challenger?.teamStrength?.oneXTwo?.[key], challenger?.teamStrength?.historical ? 1.0 : .45)
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0)
  const probability = totalWeight ? rows.reduce((sum, row) => sum + row.probability * row.weight, 0) / totalWeight : Number(candidate.probability || 0)
  const probs = rows.map(row => row.probability)
  const avg = mean(probs)
  const std = probs.length > 1 ? Math.sqrt(mean(probs.map(p => (p - avg) ** 2))) : 0
  const spread = probs.length > 1 ? Math.max(...probs) - Math.min(...probs) : 0
  let status = 'LOW'
  let penalty = 0
  if (rows.length >= 3 && (spread >= 18 || std >= 7)) { status = 'HIGH'; penalty = 3.5 }
  else if (rows.length >= 3 && (spread >= 11 || std >= 4.5)) { status = 'MEDIUM'; penalty = 1.6 }
  return {
    version: 'BETAI_PURE_MODEL_ENSEMBLE_V159',
    separation: 'MARKET_EXCLUDED_FROM_MODEL_ENSEMBLE',
    key,
    label: labelForKey(key),
    sources: rows,
    independentSources: rows.length,
    probability: round1(probability),
    modelProbability: round1(Number(candidate.probability || 0)),
    deltaVsModelPp: round1(probability - Number(candidate.probability || 0)),
    disagreement: { status, spreadPp: round1(spread), stdPp: round1(std), uncertaintyPenaltyPp: penalty }
  }
}

export function buildMarketValidationV159({ forecast = null, oddsHistory = null } = {}) {
  const candidate = forecast?.value?.top3?.[0] || forecast?.value?.top || null
  if (!candidate?.key) return null
  const modelProbability = Number(candidate?.probability || 0)
  const noVig = Number(candidate?.noVigImplied || 0)
  const delta = noVig > 0 ? modelProbability - noVig : null
  const history = (oddsHistory?.markets || []).find(item => item?.marketKey === candidate.key && (!candidate?.bookmaker || String(item?.bookmaker || '').toLowerCase() === String(candidate.bookmaker || '').toLowerCase())) || (oddsHistory?.markets || []).find(item => item?.marketKey === candidate.key) || null
  let status = 'NO_MARKET'
  if (noVig > 0) status = Math.abs(delta) <= 3 ? 'ALIGNED' : delta > 3 ? 'MODEL_ABOVE_MARKET' : 'MARKET_ABOVE_MODEL'
  return {
    version: 'BETAI_MARKET_VALIDATION_V159',
    status,
    marketIsModelInput: false,
    key: candidate.key,
    label: labelForKey(candidate.key),
    bookmaker: candidate?.bookmaker || '',
    bookmakerOdds: Number(candidate?.bookmakerOdds || 0),
    noVigProbability: noVig > 0 ? round1(noVig) : null,
    modelProbability: round1(modelProbability),
    deltaPp: delta == null ? null : round1(delta),
    clv: history ? { openOdds: Number(history.openOdds || 0), latestOdds: Number(history.latestOdds || 0), clvPct: history.clvPct, snapshots: Number(history.snapshots || 0), nearKickoff: Boolean(history.nearKickoff) } : null,
    note: 'Rynek służy wyłącznie do wyceny EDGE/CLV i kontroli ceny. Nie jest składnikiem ensemble modelu.'
  }
}

export function buildStatisticalConfidenceV161({ performance = null, candidate = null } = {}) {
  if (!candidate?.key) return { version: 'BETAI_STAT_CONFIDENCE_V161', level: 'PENDING', samples: 0, roi95: null, accuracy95: null }
  const marketKey = ['home', 'draw', 'away'].includes(candidate.key) ? 'oneXTwo'
    : candidate.key.includes('15') ? 'over15'
    : candidate.key.includes('25') ? 'over25'
    : candidate.key.includes('35') ? 'over35'
    : candidate.key.startsWith('btts') || candidate.key === 'btts' ? 'btts' : candidate.key
  const market = (performance?.statisticalConfidence?.markets || []).find(item => item?.key === marketKey) || null
  const portfolio = performance?.statisticalConfidence?.portfolio || null
  const samples = Number(market?.samples || candidate?.calibration?.samples || 0)
  let level = market?.level || (samples >= 250 ? 'HIGH' : samples >= 100 ? 'MEDIUM' : samples >= 30 ? 'LOW' : 'PENDING')
  if (portfolio?.roi95 && Number(portfolio.roi95.low) > 0 && samples >= 100) level = 'HIGH'
  return {
    version: 'BETAI_STAT_CONFIDENCE_V161',
    marketKey,
    samples,
    level,
    accuracy: market?.accuracy ?? null,
    accuracy95: market?.accuracy95 || null,
    brier: market?.brier ?? null,
    portfolioRoi: portfolio?.roi ?? null,
    roi95: portfolio?.roi95 || null,
    note: samples < 30 ? 'Za mała próba do mocnych wniosków statystycznych.' : 'Przedział 95% pokazuje niepewność wynikającą z wielkości próby.'
  }
}

export function buildAutoGateV162({ performance = null, candidate = null } = {}) {
  if (!candidate?.key) return { version: 'BETAI_AUTO_GATE_V162', status: 'PENDING', reason: 'Brak rynku.' }
  const marketKey = ['home', 'draw', 'away'].includes(candidate.key) ? 'oneXTwo'
    : candidate.key.includes('15') ? 'over15'
    : candidate.key.includes('25') ? 'over25'
    : candidate.key.includes('35') ? 'over35'
    : candidate.key.startsWith('btts') || candidate.key === 'btts' ? 'btts' : candidate.key
  const gate = (performance?.autoGate?.markets || []).find(item => item?.key === marketKey) || null
  return {
    version: 'BETAI_AUTO_GATE_V162',
    marketKey,
    status: gate?.status || 'PENDING',
    reason: gate?.reason || 'Brak wystarczającej historii do automatycznej bramki.',
    samples: Number(gate?.samples || 0),
    brier: Number(gate?.brier || 0),
    driftStatus: gate?.driftStatus || 'PENDING',
    trustScore: Number(gate?.trustScore || 0)
  }
}

function pairCorrelation(a = '', b = '') {
  const x = String(a), y = String(b)
  if (x === y) return 1
  const pair = [x, y].sort().join('|')
  const map = {
    'over15|over25': .82, 'over15|over35': .64, 'over25|over35': .78,
    'btts|over15': .62, 'btts|over25': .66, 'btts|over35': .48,
    'bttsYes|over15': .62, 'bttsYes|over25': .66, 'bttsYes|over35': .48,
    'bttsNo|under25': .58, 'bttsNo|under35': .48,
    'under15|under25': .78, 'under15|under35': .60, 'under25|under35': .80
  }
  if (map[pair] != null) return map[pair]
  if ((['home', 'away'].includes(x) && y.startsWith('over')) || (['home', 'away'].includes(y) && x.startsWith('over'))) return .28
  if ((x === 'draw' && y.startsWith('under')) || (y === 'draw' && x.startsWith('under'))) return .34
  return .08
}

export function buildCorrelationRiskV165(forecast = null) {
  const picks = (forecast?.value?.top3 || []).slice(0, 3)
  if (picks.length < 2) return { version: 'BETAI_CORRELATION_RISK_V165', level: 'LOW', score: 10, maxCorrelation: 0, pairs: [], note: 'Za mało jednoczesnych sygnałów do oceny korelacji.' }
  const pairs = []
  for (let i = 0; i < picks.length; i += 1) {
    for (let j = i + 1; j < picks.length; j += 1) {
      const corr = pairCorrelation(picks[i].key, picks[j].key)
      pairs.push({ a: picks[i].key, b: picks[j].key, aLabel: labelForKey(picks[i].key), bLabel: labelForKey(picks[j].key), correlation: round2(corr) })
    }
  }
  const maxCorrelation = pairs.length ? Math.max(...pairs.map(item => item.correlation)) : 0
  const avgCorrelation = pairs.length ? mean(pairs.map(item => item.correlation)) : 0
  const score = Math.round(clamp(maxCorrelation * 70 + avgCorrelation * 30, 0, 100, 0))
  const level = score >= 65 ? 'HIGH' : score >= 38 ? 'MEDIUM' : 'LOW'
  return {
    version: 'BETAI_CORRELATION_RISK_V165',
    level,
    score,
    maxCorrelation: round2(maxCorrelation),
    averageCorrelation: round2(avgCorrelation),
    pairs: pairs.sort((a, b) => b.correlation - a.correlation),
    exposureMultiplier: level === 'HIGH' ? .60 : level === 'MEDIUM' ? .80 : 1,
    note: level === 'HIGH' ? 'Kilka sygnałów zależy od podobnego scenariusza meczu — traktuj je jako jedną ekspozycję, nie niezależne typy.' : 'Korelacja bieżących sygnałów jest pod kontrolą.'
  }
}

export function buildModelLabV166({ match = {}, data = {}, forecast = null, consensus = null, performance = null, oddsHistory = null, challenger = null } = {}) {
  if (!forecast) return null
  const candidate = forecast?.value?.top3?.[0] || forecast?.value?.top || null
  const selection = chooseActiveModelV160(performance)
  const pureEnsemble = buildPureModelEnsembleV159({ data, forecast, consensus, challenger })
  const marketValidation = buildMarketValidationV159({ forecast, oddsHistory })
  const confidence = buildStatisticalConfidenceV161({ performance, candidate })
  const autoGate = buildAutoGateV162({ performance, candidate })
  const correlationRisk = buildCorrelationRiskV165(forecast)
  return {
    version: 'BETAI_PREDICTION_ENGINE_2_V166',
    modules: ['V159_MODEL_MARKET_SEPARATION','V160_CHAMPION_CHALLENGER','V161_STATISTICAL_CONFIDENCE','V162_AUTO_GATE','V163_DIXON_COLES','V164_TEAM_STRENGTH','V165_CORRELATION_RISK','V166_MODEL_DASHBOARD'],
    selection,
    champion: forecast?.modelVariants?.champion || null,
    challenger: challenger || forecast?.modelVariants?.challenger || null,
    pureEnsemble,
    marketValidation,
    statisticalConfidence: confidence,
    autoGate,
    correlationRisk,
    dashboard: {
      health: performance?.controlCenter?.health || 'PENDING',
      activeModel: selection.activeModel,
      settled: Number(performance?.all?.matches || 0),
      pairedSamples: selection.pairedSamples,
      brier: Number(performance?.all?.avgBrier || 0),
      last30Brier: Number(performance?.last30?.avgBrier || 0),
      shadowRoi: Number(performance?.paperPortfolio?.roi || 0),
      avgClv: Number(performance?.paperPortfolio?.avgClv ?? performance?.all?.avgClv ?? 0),
      gate: autoGate.status,
      statConfidence: confidence.level,
      correlationRisk: correlationRisk.level
    }
  }
}
