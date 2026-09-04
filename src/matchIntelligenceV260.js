import { dixonColesForecastV163 } from './predictionLabV166'

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
const safe = value => String(value == null ? '' : value).trim()

function normalizeTriplet(percent = {}) {
  const home = clamp(percent?.home, 0, 100)
  const draw = clamp(percent?.draw, 0, 100)
  const away = clamp(percent?.away, 0, 100)
  const sum = home + draw + away
  if (!(sum > 0)) return { home: 33.3, draw: 33.4, away: 33.3 }
  return { home: home * 100 / sum, draw: draw * 100 / sum, away: away * 100 / sum }
}

function lineupNames(side = {}) {
  return (Array.isArray(side?.startXI) ? side.startXI : []).map(p => ({ id: safe(p?.id), name: safe(p?.name), pos: safe(p?.pos).toUpperCase() })).filter(p => p.id || p.name)
}
function playerKey(player = {}) { return safe(player?.id) || norm(player?.name) }
function goalkeeper(side = {}) {
  const xi = lineupNames(side)
  return xi.find(p => p.pos === 'G' || /GOAL/.test(p.pos)) || null
}
function priorLineup(sideContext = {}) {
  const rows = Array.isArray(sideContext?.last_lineup) ? sideContext.last_lineup : Array.isArray(sideContext?.lastLineup) ? sideContext.lastLineup : []
  return rows.map(p => ({ id: safe(p?.id), name: safe(p?.name), pos: safe(p?.pos).toUpperCase() })).filter(p => p.id || p.name)
}

function lineupContinuity(current = {}, previousContext = {}) {
  const currentXI = lineupNames(current)
  const previousXI = priorLineup(previousContext)
  if (currentXI.length < 11 || previousXI.length < 8) {
    const predictedConfidence = Number(current?.predictionConfidence || 0)
    return {
      available: false,
      score: predictedConfidence ? Math.round(clamp(predictedConfidence, 35, 90, 55)) : 50,
      retained: null,
      changes: null,
      source: predictedConfidence ? 'predicted-lineup-confidence' : 'tracking',
      label: 'TRACKING'
    }
  }
  const old = new Set(previousXI.map(playerKey).filter(Boolean))
  const retained = currentXI.filter(p => old.has(playerKey(p))).length
  const changes = Math.max(0, 11 - retained)
  const score = Math.round(clamp(retained / 11 * 100, 0, 100, 50))
  return { available: true, score, retained, changes, source: 'previous-tracked-lineup', label: score >= 82 ? 'HIGH' : score >= 64 ? 'MEDIUM' : 'LOW' }
}

function injuryImportance(data = {}, side = 'home', previousContext = {}) {
  const teamId = String(data?.fixture?.[side]?.id || '')
  const rows = (Array.isArray(data?.injuries?.items) ? data.injuries.items : []).filter(row => !teamId || String(row?.teamId || '') === teamId)
  const previousXI = priorLineup(previousContext)
  const priorMap = new Map(previousXI.map(p => [playerKey(p), p]))
  const posWeight = p => {
    const pos = safe(p?.pos).toUpperCase()
    if (pos === 'G' || /GOAL/.test(pos)) return 1.45
    if (pos === 'F' || /ATTACK/.test(pos)) return 1.25
    if (pos === 'D' || /DEF/.test(pos)) return 1.10
    if (pos === 'M' || /MID/.test(pos)) return 1.00
    return 0.78
  }
  const items = rows.map(row => {
    const key = norm(row?.player)
    const prior = priorMap.get(key) || [...priorMap.entries()].find(([k]) => k && key && (k.includes(key) || key.includes(k)))?.[1] || null
    const starter = Boolean(prior)
    const impact = starter ? 1.0 * posWeight(prior) : 0.42
    return { player: safe(row?.player), reason: safe(row?.reason || row?.type), previousStarter: starter, previousPosition: safe(prior?.pos), impact: round2(impact) }
  })
  const score = round2(items.reduce((sum, row) => sum + row.impact, 0))
  return {
    count: rows.length,
    knownPreviousStartersOut: items.filter(x => x.previousStarter).length,
    score,
    label: score >= 2.4 ? 'HIGH' : score >= 1.2 ? 'MEDIUM' : score > 0 ? 'LOW' : 'NONE',
    items: items.slice(0, 10),
    evidence: previousXI.length >= 8 ? 'previous-tracked-lineup' : 'absence-count-only'
  }
}

function goalkeeperIntelligence(current = {}, previousContext = {}) {
  const now = goalkeeper(current)
  const previousName = safe(previousContext?.last_goalkeeper || previousContext?.lastGoalkeeper)
  const currentName = safe(now?.name)
  const changed = Boolean(currentName && previousName && norm(currentName) !== norm(previousName))
  return {
    known: Boolean(currentName),
    current: currentName || null,
    previous: previousName || null,
    changed,
    status: changed ? 'GK_CHANGE' : currentName && previousName ? 'STABLE' : currentName ? 'TRACKING' : 'UNKNOWN',
    opponentXgImpact: changed ? 0.08 : 0
  }
}

function managerIntelligence(current = {}, previousContext = {}) {
  const currentCoach = safe(current?.coach)
  const previousCoach = safe(previousContext?.current_coach || previousContext?.currentCoach)
  const changedAt = previousContext?.coach_changed_at || previousContext?.coachChangedAt || null
  const changed = Boolean(currentCoach && previousCoach && norm(currentCoach) !== norm(previousCoach))
  return {
    current: currentCoach || null,
    previous: changed ? previousCoach : safe(previousContext?.previous_coach || previousContext?.previousCoach) || null,
    changed,
    changedAt: changed ? new Date().toISOString() : changedAt,
    status: changed ? 'NEW_MANAGER' : currentCoach && previousCoach ? 'STABLE' : currentCoach ? 'TRACKING' : 'UNKNOWN',
    confidencePenalty: changed ? 7 : 0,
    formDecayBoost: changed ? 0.18 : 0
  }
}

function splitRecent(rows = []) {
  const home = (rows || []).filter(r => String(r?.venue || '').toUpperCase() === 'H')
  const away = (rows || []).filter(r => String(r?.venue || '').toUpperCase() === 'A')
  const avg = (list, key, fallback) => list.length ? mean(list.map(r => Number(r?.[key])).filter(Number.isFinite)) : fallback
  return {
    home: { sample: home.length, gf: avg(home, 'gf', null), ga: avg(home, 'ga', null) },
    away: { sample: away.length, gf: avg(away, 'gf', null), ga: avg(away, 'ga', null) }
  }
}

function tacticalMatchup(data = {}) {
  const hs = data?.teamStats?.home || {}, as = data?.teamStats?.away || {}
  const hRecent = splitRecent(data?.recent?.home || [])
  const aRecent = splitRecent(data?.recent?.away || [])
  const hAttack = Number(hRecent.home.gf ?? hs.goalsForAvg ?? 1.35)
  const hDefence = Number(hRecent.home.ga ?? hs.goalsAgainstAvg ?? 1.25)
  const aAttack = Number(aRecent.away.gf ?? as.goalsForAvg ?? 1.15)
  const aDefence = Number(aRecent.away.ga ?? as.goalsAgainstAvg ?? 1.35)
  const homeMatchup = clamp((hAttack - aDefence) * 0.065, -0.10, 0.10, 0)
  const awayMatchup = clamp((aAttack - hDefence) * 0.060, -0.10, 0.10, 0)
  return {
    homeAttackVsAwayDefence: round2(homeMatchup),
    awayAttackVsHomeDefence: round2(awayMatchup),
    homeVenueSample: hRecent.home.sample,
    awayVenueSample: aRecent.away.sample,
    label: Math.abs(homeMatchup - awayMatchup) >= .08 ? 'STRONG_MATCHUP' : Math.abs(homeMatchup - awayMatchup) >= .04 ? 'EDGE' : 'BALANCED'
  }
}

function setPieceIntelligence(data = {}) {
  const h = data?.teamStats?.home || {}, a = data?.teamStats?.away || {}
  const homePen = Number(h?.penaltiesScored || 0), awayPen = Number(a?.penaltiesScored || 0)
  const available = Boolean(h?.penaltiesTotal != null || a?.penaltiesTotal != null || data?.setPieces?.available)
  return {
    available,
    homePenaltySignal: homePen,
    awayPenaltySignal: awayPen,
    xgAdjustmentHome: 0,
    xgAdjustmentAway: 0,
    status: available ? 'PARTIAL_DATA' : 'NO_RELIABLE_DATA',
    note: available ? 'Dostępny jest tylko ograniczony sygnał stałych fragmentów; bez pełnych danych rożnych/wolnych nie koryguje xG.' : 'Brak pełnych, wiarygodnych danych o rożnych/wolnych — moduł nie zgaduje i nie zmienia xG.'
  }
}

function scheduleStress(rows = [], kickoffRaw = '') {
  const kickoff = Date.parse(kickoffRaw || '')
  if (!Number.isFinite(kickoff)) return { score: 0, label: 'UNKNOWN', restDays: null, matches7d: 0, cupMatches14d: 0, extraTime14d: 0, cityChanges14d: 0, xgPenalty: 0 }
  const valid = (rows || []).map(r => ({ ...r, t: Date.parse(r?.date || '') })).filter(r => Number.isFinite(r.t) && r.t < kickoff).sort((a,b) => b.t - a.t)
  if (!valid.length) return { score: 0, label: 'UNKNOWN', restDays: null, matches7d: 0, cupMatches14d: 0, extraTime14d: 0, cityChanges14d: 0, xgPenalty: 0 }
  const last14 = valid.filter(r => kickoff - r.t <= 14 * 86400000)
  const matches7d = valid.filter(r => kickoff - r.t <= 7 * 86400000).length
  const cupMatches14d = last14.filter(r => /cup|champions|europa|conference|puchar|copa|coppa|coupe|pok(al|al)|fa cup|dfb/i.test(String(r?.league || ''))).length
  const extraTime14d = last14.filter(r => ['AET','PEN'].includes(String(r?.statusShort || '').toUpperCase())).length
  const cities = last14.map(r => safe(r?.city)).filter(Boolean)
  const cityChanges14d = cities.slice(1).reduce((n, city, i) => n + (norm(city) !== norm(cities[i]) ? 1 : 0), 0)
  const restDays = (kickoff - valid[0].t) / 86400000
  let score = 0
  if (restDays < 3) score += 42
  else if (restDays < 4) score += 25
  else if (restDays < 5) score += 10
  if (matches7d >= 3) score += 28
  else if (matches7d >= 2) score += 14
  score += Math.min(16, cupMatches14d * 5)
  score += Math.min(16, extraTime14d * 9)
  score += Math.min(10, cityChanges14d * 2)
  score = Math.round(clamp(score, 0, 100, 0))
  const xgPenalty = round2(clamp(score / 100 * .14, 0, .14, 0))
  return { score, label: score >= 65 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW', restDays: round1(restDays), matches7d, cupMatches14d, extraTime14d, cityChanges14d, xgPenalty }
}

function contextShock({ fixture = {}, home = {}, away = {} } = {}) {
  const shocks = []
  const push = (side, type, severity, detail) => shocks.push({ side, type, severity, detail })
  for (const [side, row] of [['home',home],['away',away]]) {
    if (row.manager?.changed) push(side, 'MANAGER_CHANGE', 'HIGH', `${row.manager.previous || 'poprzedni trener'} → ${row.manager.current || 'nowy trener'}`)
    if (row.goalkeeper?.changed) push(side, 'GOALKEEPER_CHANGE', 'MEDIUM', `${row.goalkeeper.previous || 'poprzedni GK'} → ${row.goalkeeper.current || 'nowy GK'}`)
    if (row.continuity?.available && Number(row.continuity.changes) >= 5) push(side, 'LINEUP_ROTATION', 'HIGH', `${row.continuity.changes} zmian względem ostatniego śledzonego XI`)
    else if (row.continuity?.available && Number(row.continuity.changes) >= 3) push(side, 'LINEUP_ROTATION', 'MEDIUM', `${row.continuity.changes} zmiany względem ostatniego śledzonego XI`)
    if (row.injuryImportance?.knownPreviousStartersOut >= 3) push(side, 'STARTERS_OUT', 'HIGH', `${row.injuryImportance.knownPreviousStartersOut} zawodników z poprzedniego XI w absencjach`)
    if (row.schedule?.label === 'HIGH') push(side, 'SCHEDULE_STRESS', 'MEDIUM', `stress ${row.schedule.score}/100`)
  }
  const round = safe(fixture?.round)
  if (/\b(round|regular season|matchday)\s*[-:]?\s*[1-3]\b/i.test(round) || /\b[1-3](st|nd|rd)?\s*(round|matchday)\b/i.test(round)) push('match','EARLY_SEASON','MEDIUM',round)
  const high = shocks.filter(x => x.severity === 'HIGH').length
  const med = shocks.filter(x => x.severity === 'MEDIUM').length
  return { count: shocks.length, high, medium: med, level: high ? 'HIGH' : med >= 2 ? 'MEDIUM' : shocks.length ? 'LOW' : 'NONE', shocks }
}

export function buildContextEngineV220({ match = {}, data = {}, baseXg = null } = {}) {
  const prior = data?.teamContextV260 || {}
  const homePrior = prior?.home || {}
  const awayPrior = prior?.away || {}
  const homeLineup = data?.lineups?.home || {}
  const awayLineup = data?.lineups?.away || {}
  const kickoff = data?.fixture?.date || match?.rawDate || match?.date || ''

  const home = {
    continuity: lineupContinuity(homeLineup, homePrior),
    injuryImportance: injuryImportance(data, 'home', homePrior),
    goalkeeper: goalkeeperIntelligence(homeLineup, homePrior),
    manager: managerIntelligence(homeLineup, homePrior),
    schedule: scheduleStress(data?.recent?.home || [], kickoff)
  }
  const away = {
    continuity: lineupContinuity(awayLineup, awayPrior),
    injuryImportance: injuryImportance(data, 'away', awayPrior),
    goalkeeper: goalkeeperIntelligence(awayLineup, awayPrior),
    manager: managerIntelligence(awayLineup, awayPrior),
    schedule: scheduleStress(data?.recent?.away || [], kickoff)
  }
  const tactical = tacticalMatchup(data)
  const setPieces = setPieceIntelligence(data)
  const shock = contextShock({ fixture:data?.fixture || match, home, away })

  // V220 is an incremental context layer. Generic injury-count/fatigue adjustments already exist in V180,
  // so this layer only adds information that V180 did not have: prior-XI continuity, specific prior starter loss,
  // goalkeeper/manager change, venue matchup, and shock-based uncertainty. This avoids double counting.
  let homeAdj = tactical.homeAttackVsAwayDefence - tactical.awayAttackVsHomeDefence * .18
  let awayAdj = tactical.awayAttackVsHomeDefence - tactical.homeAttackVsAwayDefence * .18
  if (home.continuity.available) homeAdj += clamp((home.continuity.score - 72) / 100 * .10, -.08, .03, 0)
  if (away.continuity.available) awayAdj += clamp((away.continuity.score - 72) / 100 * .10, -.08, .03, 0)
  homeAdj -= clamp(home.injuryImportance.knownPreviousStartersOut * .035, 0, .14, 0)
  awayAdj -= clamp(away.injuryImportance.knownPreviousStartersOut * .035, 0, .14, 0)
  homeAdj += away.goalkeeper.opponentXgImpact
  awayAdj += home.goalkeeper.opponentXgImpact
  if (home.manager.changed) homeAdj -= .035
  if (away.manager.changed) awayAdj -= .035
  // Only the EXTRA schedule signal (AET/cup/city changes) is added; basic rest/congestion is already V180.
  homeAdj -= clamp(home.schedule.extraTime14d * .025 + home.schedule.cupMatches14d * .006 + home.schedule.cityChanges14d * .002, 0, .08, 0)
  awayAdj -= clamp(away.schedule.extraTime14d * .025 + away.schedule.cupMatches14d * .006 + away.schedule.cityChanges14d * .002, 0, .08, 0)
  homeAdj = round2(clamp(homeAdj, -.22, .20, 0))
  awayAdj = round2(clamp(awayAdj, -.22, .20, 0))

  const baseHome = Number(baseXg?.home || 1.35), baseAway = Number(baseXg?.away || 1.10)
  const adjustedXg = { home: round2(clamp(baseHome + homeAdj, .15, 4.1, baseHome)), away: round2(clamp(baseAway + awayAdj, .12, 3.9, baseAway)) }
  const evidence = [home.continuity.available, away.continuity.available, Boolean(home.manager.current), Boolean(away.manager.current), Boolean(home.goalkeeper.current), Boolean(away.goalkeeper.current), Number(tactical.homeVenueSample) >= 2, Number(tactical.awayVenueSample) >= 2]
  const dataConfidence = Math.round(clamp(48 + evidence.filter(Boolean).length * 6 - shock.high * 4, 40, 94, 58))

  return {
    version: 'BETAI_MATCH_CONTEXT_ENGINE_V220',
    modules: ['V212_LINEUP_CONTINUITY','V213_PLAYER_IMPORTANCE','V214_GOALKEEPER_INTELLIGENCE','V215_MANAGER_CHANGE','V216_TACTICAL_MATCHUP','V217_SET_PIECE_INTELLIGENCE_SAFE','V218_SCHEDULE_STRESS_2','V219_CONTEXT_SHOCK_DETECTOR','V220_CONTEXT_ADJUSTED_XG'],
    dataConfidence,
    home: { ...home, xgAdjustment: homeAdj },
    away: { ...away, xgAdjustment: awayAdj },
    tactical,
    setPieces,
    shock,
    baseXg: { home: round2(baseHome), away: round2(baseAway) },
    adjustedXg,
    registryWrite: {
      home: { teamId:safe(data?.fixture?.home?.id), teamName:safe(data?.fixture?.home?.name || match?.home), coach:safe(homeLineup?.coach), lineup:lineupNames(homeLineup), goalkeeper:safe(goalkeeper(homeLineup)?.name) },
      away: { teamId:safe(data?.fixture?.away?.id), teamName:safe(data?.fixture?.away?.name || match?.away), coach:safe(awayLineup?.coach), lineup:lineupNames(awayLineup), goalkeeper:safe(goalkeeper(awayLineup)?.name) },
      fixtureId:safe(data?.fixture?.id || match?.apiFixtureId || match?.id), fixtureDate:kickoff, league:safe(data?.fixture?.league || match?.league), season:String(data?.fixture?.season || '')
    },
    note: 'V220 stosuje tylko nowe sygnały kontekstowe ponad V180, aby nie podwajać wpływu zwykłej liczby absencji i podstawowego fatigue.'
  }
}

export function applyContextOverlayV220({ match = {}, data = {}, rawMarkets = {}, baseXg = null } = {}) {
  const context = buildContextEngineV220({ match, data, baseXg })
  const dc = dixonColesForecastV163(Number(context.adjustedXg.home), Number(context.adjustedXg.away), -0.08)
  const contextTriplet = dc?.oneXTwo || rawMarkets
  const contextGoals = dc?.goals || {}
  // Never let the new context layer dominate before it has its own OOS history.
  const weight = clamp(0.18 + (Number(context.dataConfidence || 50) - 40) / 54 * .17, .18, .35, .22)
  const baseTriplet = normalizeTriplet({ home:rawMarkets.home, draw:rawMarkets.draw, away:rawMarkets.away })
  const mixedTriplet = normalizeTriplet({
    home: baseTriplet.home * (1 - weight) + Number(contextTriplet.home || baseTriplet.home) * weight,
    draw: baseTriplet.draw * (1 - weight) + Number(contextTriplet.draw || baseTriplet.draw) * weight,
    away: baseTriplet.away * (1 - weight) + Number(contextTriplet.away || baseTriplet.away) * weight
  })
  const out = { ...rawMarkets, home:round1(mixedTriplet.home), draw:round1(mixedTriplet.draw), away:round1(mixedTriplet.away) }
  for (const key of ['over15','over25','over35','btts']) {
    const base = Number(rawMarkets?.[key])
    const ctx = Number(contextGoals?.[key])
    if (Number.isFinite(base) && Number.isFinite(ctx)) out[key] = round1(base * (1 - weight) + ctx * weight)
  }
  return { rawMarkets:out, context, contextModel:dc, blendWeight:round2(weight) }
}

function latestPerBookmaker(rows = []) {
  const map = new Map()
  for (const row of rows) {
    const key = `${safe(row?.marketKey)}|${safe(row?.bookmaker)}`
    const t = Date.parse(row?.capturedAt || '') || 0
    const prev = map.get(key)
    if (!prev || t > prev.t) map.set(key,{...row,t})
  }
  return [...map.values()]
}

export function buildMarketIntelligenceV230({ replay = null, forecast = null, marketKey = '' } = {}) {
  const all = Array.isArray(replay?.odds) ? replay.odds : []
  const target = marketKey || forecast?.professionalLab?.decisionCard?.key || forecast?.value?.top?.key || 'over25'
  const normalizedTarget = target === 'btts' ? 'bttsYes' : target
  const rows = all.filter(x => x.marketKey === normalizedTarget || (normalizedTarget === 'bttsYes' && x.marketKey === 'btts'))
  const latest = latestPerBookmaker(rows)
  const implied = latest.map(r => ({ ...r, implied: Number(r.odds) > 1 ? 100 / Number(r.odds) : null })).filter(r => Number.isFinite(r.implied))
  const avgImp = implied.length ? mean(implied.map(r => r.implied)) : null
  const dispersion = implied.length >= 2 ? Math.sqrt(mean(implied.map(r => (r.implied - avgImp) ** 2))) : 0
  const chronological = [...rows].sort((a,b) => Date.parse(a.capturedAt || '') - Date.parse(b.capturedAt || ''))
  const first = chronological[0] || null, last = chronological[chronological.length - 1] || null
  const firstImp = Number(first?.odds) > 1 ? 100 / Number(first.odds) : null
  const lastImp = Number(last?.odds) > 1 ? 100 / Number(last.odds) : null
  const marketMovePp = Number.isFinite(firstImp) && Number.isFinite(lastImp) ? round1(lastImp - firstImp) : 0
  const steam = marketMovePp >= 3 ? 'STRONG_SHORTENING' : marketMovePp >= 1.5 ? 'SHORTENING' : marketMovePp <= -3 ? 'STRONG_DRIFT' : marketMovePp <= -1.5 ? 'DRIFT' : 'STABLE'
  const modelProbability = Number(forecast?.professionalLab?.decisionCard?.conservativeProbability || forecast?.value?.top?.probability || forecast?.goals?.[normalizedTarget === 'bttsYes' ? 'btts' : normalizedTarget] || forecast?.oneXTwo?.[normalizedTarget] || 0)
  const modelEdgeVsConsensus = Number.isFinite(avgImp) && modelProbability ? round1(modelProbability - avgImp) : null
  const modelDirection = modelProbability && Number.isFinite(firstImp) ? modelProbability - firstImp : 0
  const reverse = Boolean(Math.abs(modelDirection) >= 3 && Math.abs(marketMovePp) >= 1.5 && Math.sign(modelDirection) !== Math.sign(marketMovePp))
  const median = implied.length ? [...implied.map(r => r.implied)].sort((a,b)=>a-b)[Math.floor(implied.length/2)] : null
  const stale = implied.filter(r => Number.isFinite(median) && Math.abs(r.implied - median) >= Math.max(2.8, dispersion * 1.7)).map(r => ({ bookmaker:r.bookmaker, odds:r.odds, implied:round1(r.implied), deltaPp:round1(r.implied-median) }))
  const timeline = chronological.map(r => ({ window:r.window, at:r.capturedAt, bookmaker:r.bookmaker, odds:Number(r.odds), marketProbability:round1(100/Number(r.odds)), modelProbability:Number(r.modelProbability || 0), edgePp:Number(r.edgePp || 0) })).slice(-30)
  return {
    version:'BETAI_MARKET_INTELLIGENCE_V230',
    modules:['V221_BOOKMAKER_CONSENSUS','V222_MARKET_DISPERSION','V223_STEAM_MOVE','V224_REVERSE_MOVE','V225_STALE_ODDS','V226_MODEL_MARKET_TIMELINE','V227_TRUE_PRICE_BAND','V228_MARKET_STABILITY','V229_MARKET_CONFIRMATION','V230_MARKET_RADAR'],
    marketKey:normalizedTarget,
    bookmakerCount:implied.length,
    consensusImpliedProbability:Number.isFinite(avgImp)?round1(avgImp):null,
    dispersionPp:round1(dispersion),
    stability:dispersion <= 1.3 ? 'HIGH' : dispersion <= 2.6 ? 'MEDIUM' : 'LOW',
    marketMovePp,
    steam,
    reverseMove:reverse,
    staleOdds:stale,
    modelProbability:round1(modelProbability),
    modelEdgeVsConsensus,
    confirmation:Number.isFinite(modelEdgeVsConsensus) ? (modelEdgeVsConsensus >= 3 && marketMovePp >= 0 ? 'CONFIRMED' : modelEdgeVsConsensus >= 3 && marketMovePp < -1.5 ? 'DIVERGENCE' : 'NEUTRAL') : 'NO_DATA',
    timeline
  }
}

function scenarioForecast(xg = {}) {
  const dc = dixonColesForecastV163(clamp(xg.home,.12,4.5,1.35), clamp(xg.away,.12,4.5,1.10), -0.08)
  return { xg:{home:round2(xg.home),away:round2(xg.away)}, oneXTwo:{home:round1(dc.oneXTwo.home),draw:round1(dc.oneXTwo.draw),away:round1(dc.oneXTwo.away)}, goals:{over15:round1(dc.goals.over15),over25:round1(dc.goals.over25),over35:round1(dc.goals.over35),btts:round1(dc.goals.btts)}, topScores:(dc.topScores||[]).slice(0,3) }
}

export const SCENARIO_PRESETS_V238 = [
  { key:'normal', label:'NORMAL', homeXg:0, awayXg:0, note:'Bez dodatkowej zmiany.' },
  { key:'home_attacker_out', label:'HOME: kluczowy napastnik OUT', homeXg:-.18, awayXg:0, note:'Heurystyczny scenariusz; nie jest automatycznym ratingiem konkretnego zawodnika.' },
  { key:'away_attacker_out', label:'AWAY: kluczowy napastnik OUT', homeXg:0, awayXg:-.18, note:'Heurystyczny scenariusz; nie jest automatycznym ratingiem konkretnego zawodnika.' },
  { key:'home_gk_change', label:'HOME: zmiana GK', homeXg:0, awayXg:.12, note:'Symulacja wpływu zmiany bramkarza.' },
  { key:'away_gk_change', label:'AWAY: zmiana GK', homeXg:.12, awayXg:0, note:'Symulacja wpływu zmiany bramkarza.' },
  { key:'home_rotation', label:'HOME: duża rotacja XI', homeXg:-.11, awayXg:.05, note:'Symulacja 4–5 zmian w podstawowym XI.' },
  { key:'away_rotation', label:'AWAY: duża rotacja XI', homeXg:.05, awayXg:-.11, note:'Symulacja 4–5 zmian w podstawowym XI.' },
  { key:'home_fatigue', label:'HOME: wysoki fatigue', homeXg:-.12, awayXg:.04, note:'Symulacja silnego obciążenia terminarza.' },
  { key:'away_fatigue', label:'AWAY: wysoki fatigue', homeXg:.04, awayXg:-.12, note:'Symulacja silnego obciążenia terminarza.' }
]

export function buildScenarioV238({ forecast = null, presetKey = 'normal' } = {}) {
  const preset = SCENARIO_PRESETS_V238.find(x => x.key === presetKey) || SCENARIO_PRESETS_V238[0]
  const base = forecast?.contextV260?.adjustedXg || forecast?.xg || {home:1.35,away:1.10}
  const xg = { home:clamp(Number(base.home)+preset.homeXg,.12,4.5,1.35), away:clamp(Number(base.away)+preset.awayXg,.12,4.5,1.10) }
  return { version:'BETAI_SCENARIO_LAB_V238', modules:['V231_WHAT_IF_CORE','V232_PLAYER_OUT_SCENARIO','V233_GK_SCENARIO','V234_LINEUP_ROTATION_SCENARIO','V235_FATIGUE_SCENARIO','V236_XG_RECALC','V237_MARKET_RECALC','V238_SCENARIO_LAB'], preset, baseXg:{home:round2(base.home),away:round2(base.away)}, ...scenarioForecast(xg) }
}

export function buildMatchReportV245({ match = {}, forecast = null, context = null, market = null, professionalLab = null } = {}) {
  const home = safe(match?.home || context?.registryWrite?.home?.teamName || 'Gospodarze')
  const away = safe(match?.away || context?.registryWrite?.away?.teamName || 'Goście')
  const decision = professionalLab?.decisionCard || forecast?.professionalLab?.decisionCard || {}
  const probs = forecast?.oneXTwo || {}
  const best = [['home',Number(probs.home),home],['draw',Number(probs.draw),'Remis'],['away',Number(probs.away),away]].sort((a,b)=>b[1]-a[1])[0]
  const reasons = []
  const risks = []
  if (context?.tactical?.label === 'STRONG_MATCHUP') reasons.push(`profil atak/obrona tworzy wyraźny matchup (${context.tactical.homeAttackVsAwayDefence >= context.tactical.awayAttackVsHomeDefence ? home : away})`)
  if (context?.home?.continuity?.available && context.home.continuity.score >= 82) reasons.push(`${home} ma wysoką ciągłość XI (${context.home.continuity.retained}/11)`)
  if (context?.away?.continuity?.available && context.away.continuity.score >= 82) reasons.push(`${away} ma wysoką ciągłość XI (${context.away.continuity.retained}/11)`)
  if (market?.confirmation === 'CONFIRMED') reasons.push('ruch rynku nie przeczy przewadze modelu')
  if (context?.home?.manager?.changed || context?.away?.manager?.changed) risks.push('niedawna zmiana trenera zwiększa niepewność formy historycznej')
  if (context?.shock?.level === 'HIGH') risks.push('Context Shock Detector wykrył istotną zmianę przed meczem')
  if (market?.reverseMove) risks.push('rynek porusza się przeciwnie do przewagi modelu')
  if (market?.stability === 'LOW') risks.push('wycena bukmacherów jest rozproszona')
  if (context?.home?.injuryImportance?.knownPreviousStartersOut >= 2 || context?.away?.injuryImportance?.knownPreviousStartersOut >= 2) risks.push('w absencjach są zawodnicy widziani wcześniej w podstawowym XI')
  if (!reasons.length) reasons.push('decyzja wynika głównie z bazowego modelu probabilistycznego i kalibracji historycznej')
  if (!risks.length) risks.push('brak silnego pojedynczego szoku; pozostaje standardowa niepewność sportowa')
  const short = `${home} – ${away}: najwyższe 1X2 to ${best?.[2]} ${round1(best?.[1] || 0)}%. Context xG ${round2(forecast?.contextV260?.adjustedXg?.home ?? forecast?.xg?.home)}–${round2(forecast?.contextV260?.adjustedXg?.away ?? forecast?.xg?.away)}. Decyzja systemu: ${safe(decision?.decision || forecast?.value?.state || 'WATCH')}.`
  const expert = `${short} Główne argumenty: ${reasons.join('; ')}. Ryzyka: ${risks.join('; ')}. ${market?.modelEdgeVsConsensus != null ? `Model vs bookmaker consensus: ${market.modelEdgeVsConsensus >= 0 ? '+' : ''}${market.modelEdgeVsConsensus} pp.` : 'Brak wystarczającego bookmaker consensus do niezależnego potwierdzenia.'}`
  return { version:'BETAI_AI_MATCH_REPORT_V245', modules:['V239_FACT_EXTRACTOR','V240_30_SECOND_REPORT','V241_EXPERT_REPORT','V242_RISK_REPORT','V243_CHANGE_TRIGGERS','V244_NO_HALLUCINATION_GUARD','V245_AI_MATCH_REPORT'], short, expert, reasons, risks, changeTriggers:['potwierdzony XI różny od przewidywanego','zmiana podstawowego bramkarza','nowa kluczowa absencja','silny ruch kursu','zmiana trenera'], generatedFrom:'structured-model-data-only' }
}

export function similaritySignatureV252({ forecast = null, league = '', odds = null } = {}) {
  return {
    league:safe(league),
    home:Number(forecast?.oneXTwo?.home || 0), draw:Number(forecast?.oneXTwo?.draw || 0), away:Number(forecast?.oneXTwo?.away || 0),
    over25:Number(forecast?.goals?.over25 || 0), btts:Number(forecast?.goals?.btts || 0),
    xgHome:Number(forecast?.contextV260?.adjustedXg?.home ?? forecast?.xg?.home ?? 0), xgAway:Number(forecast?.contextV260?.adjustedXg?.away ?? forecast?.xg?.away ?? 0),
    dataQuality:Number(forecast?.dataQuality || 0), odds:Number(odds || forecast?.professionalLab?.decisionCard?.bookmakerOdds || forecast?.value?.top?.bookmakerOdds || 0)
  }
}

export const V260_MODULES = [
  'V212_LINEUP_CONTINUITY','V213_PLAYER_IMPORTANCE','V214_GOALKEEPER_INTELLIGENCE','V215_MANAGER_CHANGE_ENGINE','V216_TACTICAL_MATCHUP','V217_SET_PIECE_INTELLIGENCE_SAFE','V218_SCHEDULE_STRESS_2','V219_CONTEXT_SHOCK_DETECTOR','V220_CONTEXT_ADJUSTED_XG',
  'V221_BOOKMAKER_CONSENSUS','V222_MARKET_DISPERSION','V223_STEAM_MOVE','V224_REVERSE_MOVE','V225_STALE_ODDS','V226_MODEL_MARKET_TIMELINE','V227_TRUE_PRICE_BAND','V228_MARKET_STABILITY','V229_MARKET_CONFIRMATION','V230_MARKET_RADAR',
  'V231_WHAT_IF_CORE','V232_PLAYER_OUT_SCENARIO','V233_GK_SCENARIO','V234_LINEUP_ROTATION_SCENARIO','V235_FATIGUE_SCENARIO','V236_XG_RECALC','V237_MARKET_RECALC','V238_SCENARIO_LAB',
  'V239_FACT_EXTRACTOR','V240_30_SECOND_REPORT','V241_EXPERT_REPORT','V242_RISK_REPORT','V243_CHANGE_TRIGGERS','V244_NO_HALLUCINATION_GUARD','V245_AI_MATCH_REPORT',
  'V246_SIMILARITY_SIGNATURE','V247_HISTORICAL_NEIGHBORS','V248_OUTCOME_MEMORY','V249_MARKET_MEMORY','V250_LEAGUE_AWARE_MEMORY','V251_MEMORY_CONFIDENCE','V252_SIMILAR_MATCH_MEMORY',
  'V253_TODAY_OVERVIEW','V254_DECISION_FUNNEL','V255_TOP_CONFIDENCE','V256_TOP_EDGE','V257_RISK_RADAR','V258_SYSTEM_HEALTH','V259_PRODUCTION_READINESS','V260_AI_COMMAND_CENTER'
]
