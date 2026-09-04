import React, { useEffect, useMemo, useRef, useState } from 'react'
import { buildChallengerRawV180, chooseActiveModelV173, buildModelLabV180, adaptiveCalibrateTripletV172, adaptiveCalibrateBinaryV172 } from './predictionLabV180'

const COPY = {
  pl: {
    eyebrow: 'BET+AI • PRZYGOTOWANIE SYMULACJI',
    title: 'Przygotowanie meczu',
    subtitle: 'Pobieramy prawdziwe dane przed uruchomieniem silnika meczu.',
    loading: 'Analizuję dane meczu…',
    ready: 'Dane gotowe',
    source: 'Baza: API-Football / API-Sports • Multi-Source Web Intelligence',
    start: 'Uruchom symulację',
    back: '← Wróć do meczów',
    retry: 'Spróbuj ponownie',
    completeness: 'Kompletność danych',
    predictive: 'Symulacja predykcyjna — wynik nie jest rzeczywistym wynikiem przyszłego meczu.',
    odds: 'Kursy 1X2',
    form: 'Forma drużyn',
    h2h: 'H2H',
    injuries: 'Absencje',
    lineups: 'Składy XI',
    standings: 'Tabela',
    teamStats: 'Statystyki drużyn',
    prediction: 'Model / prognoza API',
    checked: 'Sprawdzone',
    unavailable: 'Brak danych',
    official: 'Oficjalne XI',
    lineupsPending: 'Nie udało się zbudować XI',
    predicted: 'Przewidywane XI',
    qualified: 'MECZ ZAKWALIFIKOWANY',
    qualifiedDesc: 'Realna forma i statystyki obu drużyn spełniają próg Bet+AI. Skład XI jest dodatkiem i nie blokuje symulacji.',
    rejected: 'MECZ ODRZUCONY — ZA MAŁO DANYCH',
    rejectedDesc: 'Ten mecz nie zostanie dopuszczony do symulacji. Brakuje wymaganych realnych statystyk sportowych:',
    rejectedButton: 'Symulacja zablokowana',
    noOdds: 'Brak realnych kursów',
    liveOdds: 'Realne kursy dostępne',
    noH2H: 'Brak historii H2H',
    noInjuries: 'Brak zgłoszonych absencji',
    partial: 'Część źródeł chwilowo nie odpowiedziała. Model użyje wyłącznie dostępnych danych.',
    webIntel: 'Bet+AI Web Intelligence',
    webIntelLoading: 'Przeszukuję źródła i prognozy ekspertów…',
    webIntelOff: 'Web Intelligence wyłączone — dodaj OPENAI_API_KEY w Netlify.',
    consensus: 'Konsensus zewnętrzny',
    sourcesFound: 'źródeł znalezionych',
  },
  en: {
    eyebrow: 'BET+AI • SIMULATION PREPARATION',
    title: 'Match preparation',
    subtitle: 'Fetching real match data before starting the match engine.',
    loading: 'Analysing match data…',
    ready: 'Data ready',
    source: 'Base: API-Football / API-Sports • Multi-Source Web Intelligence',
    start: 'Start simulation',
    back: '← Back to matches',
    retry: 'Try again',
    completeness: 'Data completeness',
    predictive: 'Predictive simulation — this is not the actual future match result.',
    odds: '1X2 odds', form: 'Team form', h2h: 'H2H', injuries: 'Injuries', lineups: 'Starting XI', standings: 'Standings', teamStats: 'Team statistics', prediction: 'API prediction/model',
    checked: 'Checked', unavailable: 'Unavailable', official: 'Official XI', lineupsPending: 'Could not build XI', predicted: 'Predicted XI', qualified: 'MATCH QUALIFIED', qualifiedDesc: 'The match meets Bet+AI strict data requirements.', rejected: 'MATCH REJECTED — INSUFFICIENT DATA', rejectedDesc: 'Simulation is blocked because key data is missing:', rejectedButton: 'Simulation blocked', noOdds: 'No real odds', liveOdds: 'Real odds available', noH2H: 'No H2H history', noInjuries: 'No reported absences', partial: 'Some sources did not answer. The model will only use available data.', webIntel: 'Bet+AI Web Intelligence', webIntelLoading: 'Searching public sources and expert predictions…', webIntelOff: 'Web Intelligence disabled — add OPENAI_API_KEY in Netlify.', consensus: 'External consensus', sourcesFound: 'sources found'
  }
}

const LOAD_PHASES_PL = ['Identyfikacja meczu', 'Pobieranie formy', 'Sprawdzanie H2H', 'Sprawdzanie absencji', 'Pobieranie składów', 'Budowanie modelu AI']
const LOAD_PHASES_EN = ['Identifying fixture', 'Loading form', 'Checking H2H', 'Checking absences', 'Loading lineups', 'Building AI model']

function hasRealOdds(match = {}) {
  if (!match?.hasRealOdds || !Array.isArray(match?.markets)) return false
  return match.markets.some(item => String(item.market || '').toLowerCase() === '1x2' && Number(item.odds) > 1)
}

function errorHas(data, prefix) {
  return Array.isArray(data?.errors) && data.errors.some(item => String(item || '').toLowerCase().startsWith(String(prefix).toLowerCase()))
}

function lineupHasGrid(lineup = {}) {
  return (lineup?.startXI || []).filter(player => /^\d+:\d+$/.test(String(player?.grid || ''))).length >= 9
}

function buildChecks(match, data, copy) {
  const homeXI = data?.lineups?.home || {}
  const awayXI = data?.lineups?.away || {}
  const lineupReliable = lineup => {
    const ready = (lineup?.startXI?.length || 0) >= 11 && lineupHasGrid(lineup)
    if (!ready) return false
    if (!lineup?.predicted) return true
    if (lineup?.predictionSource === 'season-player-stats') return Number(lineup?.predictionConfidence || 0) >= 58
    return Number(lineup?.predictionConfidence || 0) >= 60 && Number(lineup?.sourceMatches || 0) >= 1
  }
  const lineupsReady = lineupReliable(homeXI) && lineupReliable(awayXI)
  const bothOfficial = lineupsReady && homeXI.official !== false && awayXI.official !== false && !homeXI.predicted && !awayXI.predicted
  const predictedSides = [homeXI, awayXI].filter(item => item?.predicted)
  const predictedConfidence = predictedSides.length ? Math.round(predictedSides.reduce((sum, item) => sum + Number(item.predictionConfidence || 0), 0) / predictedSides.length) : 0
  const sourceMatches = Math.max(Number(homeXI.sourceMatches || 0), Number(awayXI.sourceMatches || 0))
  const formReady = (data?.recent?.home?.length || 0) >= 5 && (data?.recent?.away?.length || 0) >= 5
  const h2hReady = (data?.h2h?.summary?.count || 0) >= 2
  const predictionReady = Boolean(data?.prediction?.available)
  const standingsReady = Boolean(data?.standings?.home && data?.standings?.away)
  const statsReady = Boolean(data?.teamStats?.home?.available && data?.teamStats?.away?.available)
  const injuriesFetchOk = Boolean(data?.simulationQuality?.checks?.injuries ?? !errorHas(data, 'Absencje:'))
  const oddsReady = hasRealOdds(match) || Boolean(data?.odds?.available)
  const homeStatsSource = data?.teamStats?.home?.source === 'recent-fixtures' ? `${data?.teamStats?.home?.sampleSize || 0} ostatnich` : 'sezon'
  const awayStatsSource = data?.teamStats?.away?.source === 'recent-fixtures' ? `${data?.teamStats?.away?.sampleSize || 0} ostatnich` : 'sezon'
  const lineupDetail = bothOfficial
    ? copy.official
    : lineupsReady && predictedSides.length
      ? `${copy.predicted} • ${predictedConfidence || '—'}% • ${sourceMatches || predictedSides[0]?.sourceMatches || 0} ostatnie składy`
      : copy.lineupsPending

  return [
    { key: 'odds', label: copy.odds, ready: oddsReady, required: false, detail: oddsReady ? `${copy.liveOdds}${data?.odds?.books?.length ? ` • ${data.odds.books.length} bukmacherów` : ''}` : `${copy.noOdds} • opcjonalne` },
    { key: 'form', label: copy.form, ready: formReady, required: true, detail: formReady ? `${data.recent.home.length} + ${data.recent.away.length} ${copy.checked.toLowerCase()}` : 'Wymagane min. 5 + 5 realnych meczów' },
    { key: 'h2h', label: copy.h2h, ready: h2hReady, required: false, detail: h2hReady ? `${data.h2h.summary.count} ${copy.checked.toLowerCase()}` : `${copy.noH2H} • opcjonalne` },
    { key: 'injuries', label: copy.injuries, ready: injuriesFetchOk, required: false, detail: injuriesFetchOk ? ((data?.injuries?.homeCount || 0) + (data?.injuries?.awayCount || 0) ? `${data.injuries.homeCount}:${data.injuries.awayCount}` : copy.noInjuries) : `${copy.unavailable} • opcjonalne` },
    { key: 'lineups', label: copy.lineups, ready: lineupsReady, required: false, predicted: lineupsReady && !bothOfficial, detail: lineupsReady ? lineupDetail : `${lineupDetail} • opcjonalne` },
    { key: 'standings', label: copy.standings, ready: standingsReady, required: false, detail: standingsReady ? `${data.standings.home.rank}. / ${data.standings.away.rank}.` : 'Brak tabeli • opcjonalne (np. puchar)' },
    { key: 'teamStats', label: copy.teamStats, ready: statsReady, required: true, detail: statsReady ? `${copy.checked} • ${homeStatsSource} / ${awayStatsSource}` : 'Wymagane: sezonowe lub min. 5 ostatnich meczów obu drużyn' },
    { key: 'prediction', label: copy.prediction, ready: predictionReady, required: false, detail: predictionReady ? copy.checked : `${copy.unavailable} • opcjonalne` },
  ]
}

function buildEligibility(match, data, checks) {
  const backend = data?.simulationQuality || {}
  if (typeof backend.eligible === 'boolean') {
    return { eligible: backend.eligible, reasons: Array.isArray(backend.reasons) ? backend.reasons : [], warnings: Array.isArray(backend.warnings) ? backend.warnings : [] }
  }
  const missingRequired = checks.filter(item => item.required && !item.ready).map(item => item.label)
  return { eligible: missingRequired.length === 0, reasons: missingRequired, warnings: [] }
}

function clampNum(value, min, max, fallback = 0) {
  const n = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback))
}

function avg(rows = [], key = 'gf', fallback = 0) {
  const values = (rows || []).map(row => Number(row?.[key])).filter(Number.isFinite)
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formStrength(rows = []) {
  const sample = (rows || []).slice(0, 8)
  if (!sample.length) return 50
  const points = sample.reduce((sum, row) => sum + (row?.result === 'W' ? 3 : row?.result === 'D' ? 1 : 0), 0)
  return clampNum(points / (sample.length * 3) * 100, 0, 100, 50)
}

function normalizeTriplet(percent = {}) {
  const home = clampNum(percent?.home, 0, 100)
  const draw = clampNum(percent?.draw, 0, 100)
  const away = clampNum(percent?.away, 0, 100)
  const sum = home + draw + away
  if (sum <= 0) return null
  return {
    home: home * 100 / sum,
    draw: draw * 100 / sum,
    away: away * 100 / sum
  }
}

function poissonP(lambda, goals) {
  let factorial = 1
  for (let i = 2; i <= goals; i += 1) factorial *= i
  return Math.exp(-lambda) * Math.pow(lambda, goals) / factorial
}

function poissonForecast(homeXg, awayXg) {
  const maxGoals = 8
  let home = 0, draw = 0, away = 0
  const scores = []
  for (let hg = 0; hg <= maxGoals; hg += 1) {
    for (let ag = 0; ag <= maxGoals; ag += 1) {
      const prob = poissonP(homeXg, hg) * poissonP(awayXg, ag)
      if (hg > ag) home += prob
      else if (hg === ag) draw += prob
      else away += prob
      scores.push({ score: `${hg}:${ag}`, probability: prob * 100 })
    }
  }
  scores.sort((a, b) => b.probability - a.probability)
  const total = homeXg + awayXg
  const p0 = Math.exp(-total)
  const p1 = p0 * total
  const p2 = p1 * total / 2
  const p3 = p2 * total / 3
  const over15 = (1 - p0 - p1) * 100
  const over25 = (1 - p0 - p1 - p2) * 100
  const over35 = (1 - p0 - p1 - p2 - p3) * 100
  const btts = (1 - Math.exp(-homeXg) - Math.exp(-awayXg) + Math.exp(-total)) * 100
  return {
    oneXTwo: normalizeTriplet({ home: home * 100, draw: draw * 100, away: away * 100 }),
    over15: clampNum(over15, 0, 100),
    over25: clampNum(over25, 0, 100),
    over35: clampNum(over35, 0, 100),
    btts: clampNum(btts, 0, 100),
    topScores: scores.slice(0, 5)
  }
}

function weightedTriplet(parts = []) {
  const usable = parts.filter(part => part?.value && Number(part.weight) > 0)
  const totalWeight = usable.reduce((sum, part) => sum + Number(part.weight), 0)
  if (!totalWeight) return null
  return normalizeTriplet({
    home: usable.reduce((sum, part) => sum + part.value.home * part.weight, 0) / totalWeight,
    draw: usable.reduce((sum, part) => sum + part.value.draw * part.weight, 0) / totalWeight,
    away: usable.reduce((sum, part) => sum + part.value.away * part.weight, 0) / totalWeight
  })
}

function round1(value) { return Math.round(Number(value || 0) * 10) / 10 }
function round2(value) { return Math.round(Number(value || 0) * 100) / 100 }
function fairOdd(probability) { return probability > 0 ? round2(100 / probability) : 0 }

function extractMarketOdds(match = {}) {
  const rows = Array.isArray(match?.markets) ? match.markets : []
  const result = {}
  const put = (key, item) => {
    const odd = Number(item?.odds)
    if (!Number.isFinite(odd) || odd <= 1) return
    if (!result[key] || odd > result[key].odds) result[key] = { odds: odd, bookmaker: item?.bookmaker || '', pick: item?.pick || '', market: item?.market || '' }
  }
  rows.forEach(item => {
    const market = String(item?.market || '').toLowerCase()
    const pick = String(item?.pick || '').toLowerCase()
    if (market === '1x2') {
      if (/remis/.test(pick)) put('draw', item)
      else if (String(match?.home || '').toLowerCase() && pick.includes(String(match.home).toLowerCase()) && /wygra/.test(pick)) put('home', item)
      else if (String(match?.away || '').toLowerCase() && pick.includes(String(match.away).toLowerCase()) && /wygra/.test(pick)) put('away', item)
    }
    if (market === 'gole') {
      if (/powyżej\s*1[.,]5|over\s*1[.,]5/.test(pick)) put('over15', item)
      if (/powyżej\s*2[.,]5|over\s*2[.,]5/.test(pick)) put('over25', item)
      if (/powyżej\s*3[.,]5|over\s*3[.,]5/.test(pick)) put('over35', item)
    }
    if (market === 'btts') {
      if (/tak|yes/.test(pick)) put('btts', item)
    }
  })
  return result
}


function normalizeName(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function performanceMarketKey(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 'oneXTwo'
  if (['over15', 'under15'].includes(key)) return 'over15'
  if (['over25', 'under25'].includes(key)) return 'over25'
  if (['over35', 'under35'].includes(key)) return 'over35'
  if (['bttsYes', 'bttsNo', 'btts'].includes(key)) return 'btts'
  return key
}

function findMarketPerformance(summary = null, key = '') {
  if (!summary || !Array.isArray(summary?.markets)) return null
  const target = performanceMarketKey(key)
  return summary.markets.find(item => item?.key === target) || null
}

function findCalibrationBucket(rows = [], probability = 0) {
  if (!Array.isArray(rows) || !rows.length || probability < 50) return null
  const p = clampNum(probability, 50, 99.999, 50)
  return rows.find(item => {
    const match = String(item?.range || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
    if (!match) return false
    const low = Number(match[1]); const high = Number(match[2])
    return p >= low && (p < high || (high >= 100 && p <= high))
  }) || null
}

function resolveCalibration(performance = null, league = '', key = '', probability = 0) {
  const globalSummary = performance?.all || null
  const leagueSummary = Array.isArray(performance?.leagues)
    ? performance.leagues.find(item => normalizeName(item?.name) === normalizeName(league)) || null
    : null
  const globalMarket = findMarketPerformance(globalSummary, key)
  const leagueMarket = findMarketPerformance(leagueSummary, key)
  const useLeague = Boolean(leagueMarket && Number(leagueMarket.samples || 0) >= 30)
  const summary = useLeague ? leagueSummary : globalSummary
  const market = useLeague ? leagueMarket : globalMarket
  const samples = Number(market?.samples || 0)
  const brier = Number(market?.brier || 0)
  const bucket = findCalibrationBucket(market?.calibration || [], probability)
  const bucketSamples = Number(bucket?.samples || 0)
  const gap = Number(bucket?.calibrationGap || 0)

  let status = 'PENDING'
  let reason = 'Za mała próbka historyczna'
  if (samples >= 30) {
    if (brier > 0.29) {
      status = 'POOR'
      reason = 'Historyczny Brier Score jest zbyt słaby'
    } else if (bucket && bucketSamples >= 10 && Math.abs(gap) > 8) {
      status = 'POOR'
      reason = `Kalibracja odbiega o ${Math.abs(round1(gap))} pp`
    } else if (bucket && bucketSamples >= 10 && Math.abs(gap) <= 5) {
      status = 'GOOD'
      reason = 'Historyczna pewność jest dobrze skalibrowana'
    } else {
      status = 'OK'
      reason = 'Próbka wystarczająca, kalibracja w normie'
    }
  }

  const globalBrier = Number(globalMarket?.brier || 0)
  const leaguePenalty = useLeague && globalBrier > 0 && brier > globalBrier + 0.025 ? 1.5 : 0
  return {
    status,
    reason,
    source: useLeague ? 'league' : 'global',
    samples,
    brier: round2(brier),
    bucket: bucket ? { range: bucket.range, samples: bucketSamples, gap: round1(gap), actualAccuracy: Number(bucket.actualAccuracy || 0) } : null,
    leaguePenalty
  }
}

function calibrateProbabilityV2(performance = null, league = '', key = '', rawProbability = 0) {
  const raw = clampNum(rawProbability, 0.1, 99.9, 50)
  const confidence = raw >= 50 ? raw : 100 - raw
  const calibration = resolveCalibration(performance, league, key, confidence)
  const bucket = calibration?.bucket || null
  const bucketSamples = Number(bucket?.samples || 0)
  const actualAccuracy = Number(bucket?.actualAccuracy || 0)
  if (!bucket || bucketSamples < 10 || !(actualAccuracy > 0)) {
    return { raw: round1(raw), calibrated: round1(raw), delta: 0, applied: false, calibration }
  }

  // More history = stronger correction, but never let backtest completely replace
  // the current-match model. League-specific buckets get slightly more trust.
  const historyWeight = clampNum(
    0.18 + Math.min(0.50, bucketSamples / 180) + (calibration?.source === 'league' ? 0.08 : 0),
    0.18,
    0.72,
    0.25
  )
  const calibratedConfidence = clampNum(raw * 0 + confidence * (1 - historyWeight) + actualAccuracy * historyWeight, 50.1, 96.5, confidence)
  const calibrated = raw >= 50 ? calibratedConfidence : 100 - calibratedConfidence
  return {
    raw: round1(raw),
    calibrated: round1(clampNum(calibrated, 1, 99, raw)),
    delta: round1(calibrated - raw),
    applied: true,
    historyWeight: round1(historyWeight * 100),
    calibration
  }
}

function calibrateTripletV2(performance = null, league = '', rawTriplet = null) {
  const raw = normalizeTriplet(rawTriplet)
  if (!raw) return { raw: null, calibrated: null, applied: false, top: null }
  const topKey = ['home', 'draw', 'away'].sort((a, b) => raw[b] - raw[a])[0]
  const topCal = calibrateProbabilityV2(performance, league, topKey, raw[topKey])
  if (!topCal.applied || topCal.calibrated <= 0 || topCal.calibrated >= 99) {
    return { raw, calibrated: raw, applied: false, top: { key: topKey, ...topCal } }
  }
  const others = ['home', 'draw', 'away'].filter(key => key !== topKey)
  const oldOther = Math.max(0.001, 100 - raw[topKey])
  const newOther = Math.max(0.001, 100 - topCal.calibrated)
  const calibrated = { [topKey]: topCal.calibrated }
  others.forEach(key => { calibrated[key] = raw[key] / oldOther * newOther })
  const normalized = normalizeTriplet(calibrated) || raw
  return {
    raw,
    calibrated: { home: round1(normalized.home), draw: round1(normalized.draw), away: round1(normalized.away) },
    applied: true,
    top: { key: topKey, ...topCal }
  }
}

function dynamicSourceWeightsV143({ data = {}, consensus = null, performance = null, league = '', poisson = null, apiPercent = null, webPercent = null } = {}) {
  const global1x2 = findMarketPerformance(performance?.all || null, 'home')
  const leagueSummary = Array.isArray(performance?.leagues)
    ? performance.leagues.find(item => normalizeName(item?.name) === normalizeName(league)) || null
    : null
  const league1x2 = findMarketPerformance(leagueSummary, 'home')
  const hist = Number(league1x2?.samples || 0) >= 30 ? league1x2 : global1x2
  const brier = Number(hist?.brier || 0)
  const historyQuality = hist && Number(hist.samples || 0) >= 30
    ? clampNum(100 - Math.max(0, brier - 0.16) * 250, 45, 100, 70)
    : 68

  const statsReady = Boolean(data?.teamStats?.home?.available && data?.teamStats?.away?.available)
  const recentDepth = Math.min(16, Number(data?.recent?.home?.length || 0) + Number(data?.recent?.away?.length || 0))
  const statsScore = clampNum((statsReady ? 76 : 52) + recentDepth * 1.15 + historyQuality * 0.08, 50, 98, 72)

  let apiAgreement = 60
  if (apiPercent && poisson?.oneXTwo) {
    const diff = (Math.abs(apiPercent.home - poisson.oneXTwo.home) + Math.abs(apiPercent.draw - poisson.oneXTwo.draw) + Math.abs(apiPercent.away - poisson.oneXTwo.away)) / 3
    apiAgreement = clampNum(100 - diff * 2.1, 35, 98, 60)
  }
  const apiScore = apiPercent ? clampNum(52 + apiAgreement * 0.38 + historyQuality * 0.10, 50, 94, 65) : 0

  const sourceCount = Number(consensus?.consensus?.sourceCount || 0)
  const agreement = Number(consensus?.consensus?.agreement || 0)
  const webScore = webPercent
    ? clampNum(40 + Math.min(6, sourceCount) * 5.5 + agreement * 0.28, 45, 92, 55)
    : 0

  const statsRaw = statsScore * 1.20
  const apiRaw = apiScore > 0 ? apiScore * 0.52 : 0
  const webRaw = webScore > 0 ? webScore * 0.34 : 0
  const total = Math.max(1, statsRaw + apiRaw + webRaw)
  return {
    stats: round1(statsRaw / total * 100),
    api: round1(apiRaw / total * 100),
    web: round1(webRaw / total * 100),
    diagnostics: {
      historyQuality: Math.round(historyQuality),
      apiAgreement: Math.round(apiAgreement),
      webAgreement: Math.round(agreement),
      sourceCount
    }
  }
}

function explainForecastV145({ match = {}, data = {}, consensus = null, forecast = null, homeGF = 0, homeGA = 0, awayGF = 0, awayGA = 0, homeForm = 50, awayForm = 50 } = {}) {
  const positives = []
  const risks = []
  const top = forecast?.value?.top || forecast?.value?.top3?.[0] || null
  const formDiff = homeForm - awayForm
  if (Math.abs(formDiff) >= 12) positives.push(`${formDiff > 0 ? match?.home : match?.away} ma wyraźnie lepszą formę ostatnich spotkań (${Math.round(Math.max(homeForm, awayForm))}/100 vs ${Math.round(Math.min(homeForm, awayForm))}/100).`)
  if (homeGF >= 1.65) positives.push(`${match?.home} zdobywa średnio ${round2(homeGF)} gola na mecz w dostępnej próbce.`)
  if (awayGF >= 1.65) positives.push(`${match?.away} zdobywa średnio ${round2(awayGF)} gola na mecz w dostępnej próbce.`)
  if (homeGA >= 1.45) positives.push(`${match?.home} traci średnio ${round2(homeGA)} gola — to podnosi profil bramkowy.`)
  if (awayGA >= 1.45) positives.push(`${match?.away} traci średnio ${round2(awayGA)} gola — to podnosi profil bramkowy.`)
  if (Number(consensus?.consensus?.sourceCount || 0) >= 3) {
    const a = Number(consensus?.consensus?.agreement || 0)
    ;(a >= 70 ? positives : risks).push(`Consensus: ${consensus.consensus.sourceCount} źródeł, zgodność ${Math.round(a)}%.`)
  }
  if (Number(data?.injuries?.homeCount || 0) + Number(data?.injuries?.awayCount || 0) > 0) risks.push(`Absencje: ${Number(data?.injuries?.homeCount || 0)} gospodarze / ${Number(data?.injuries?.awayCount || 0)} goście.`)
  if (!data?.prediction?.available) risks.push('Brak dodatkowej prognozy API — większa część ciężaru spoczywa na modelu statystycznym.')
  if (Number(forecast?.dataQuality || 0) < 85) risks.push(`Data Quality ${forecast?.dataQuality || 0}/100 — model podnosi wymagany próg value.`)
  if (top?.calibration?.status === 'POOR') risks.push('Historyczna kalibracja wybranego rynku jest słaba — rekomendacja jest blokowana.')
  if (top?.calibration?.status === 'PENDING') risks.push(`Kalibracja rynku ma dopiero ${top?.calibration?.samples || 0} prób.`)
  if (top?.decision === 'STRONG_VALUE' || top?.decision === 'VALUE') positives.push(`${forecastLabel(top.key)}: skalibrowane ${top.probability}% vs rynek no-vig ${top.noVigImplied}% (edge ${top.edgePp > 0 ? '+' : ''}${top.edgePp} pp).`)
  if (!positives.length) positives.push('Model nie znalazł jednego dominującego czynnika — prognoza jest wynikiem połączenia kilku umiarkowanych sygnałów.')
  if (!risks.length) risks.push('Brak dużych czerwonych flag w dostępnych danych przedmeczowych.')
  return {
    positives: positives.slice(0, 5),
    risks: risks.slice(0, 5),
    summary: top
      ? `${forecastLabel(top.key)}: model po kalibracji ${top.probability}%, fair ${Number(top.fairOdds || 0).toFixed(2)}, decyzja ${valueDecisionLabel(top.decision)}.`
      : 'Brak kompletnego rynku kursowego — model pokazuje prawdopodobieństwa, ale nie wymusza rekomendacji.'
  }
}

function baseEdgeThreshold(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 6
  if (['bttsYes', 'bttsNo', 'btts'].includes(key)) return 5.5
  return 5
}

function classifyValueCandidate(candidate = {}, context = {}) {
  const quality = Number(context.dataQuality || 0)
  const calibration = candidate.calibration || {}
  let threshold = baseEdgeThreshold(candidate.key)
  if (quality < 75) threshold += 4
  else if (quality < 85) threshold += 2.5
  else if (quality < 92) threshold += 1
  if (calibration.status === 'OK') threshold += 0.75
  threshold += Number(calibration.leaguePenalty || 0)
  if (Number(context.consensusSources || 0) >= 2 && Number(context.consensusAgreement || 0) < 60) threshold += 1
  if (Number(context.modelAgreement || 65) < 60) threshold += 1.5
  if (Number(context.modelAgreement || 65) < 50) threshold += 2
  threshold = round1(threshold)

  const calibrationScore = calibration.status === 'GOOD' ? 92 : calibration.status === 'OK' ? 76 : calibration.status === 'POOR' ? 28 : 45
  const consensusScore = Number(context.consensusSources || 0) > 0 ? Number(context.consensusAgreement || 0) : 55
  const reliabilityScore = Math.round(clampNum(quality * 0.45 + calibrationScore * 0.30 + Number(context.modelAgreement || 65) * 0.15 + consensusScore * 0.10, 0, 100))
  const reliabilityLabel = calibration.status === 'PENDING' ? 'PENDING' : calibration.status === 'POOR' || reliabilityScore < 65 ? 'LOW' : reliabilityScore >= 82 ? 'HIGH' : 'MEDIUM'

  let decision = 'NO_BET'
  let reason = ''
  if (!candidate.vigAdjusted) {
    reason = 'Brak pełnego rynku do wiarygodnego usunięcia marży bukmachera'
  } else if (quality < 75) {
    reason = 'Za niska jakość danych'
  } else if (calibration.status === 'PENDING') {
    reason = 'Za mała próbka backtestu — brak rekomendacji'
  } else if (calibration.status === 'POOR') {
    reason = 'Model jest słabo skalibrowany dla tego rynku'
  } else if (Number(context.modelAgreement || 65) < 45) {
    reason = 'Modele zbyt mocno się nie zgadzają — brak rekomendacji'
  } else if (Number(context.consensusSources || 0) >= 2 && Number(context.consensusAgreement || 0) < 45) {
    reason = 'Zewnętrzne źródła są zbyt rozbieżne — brak rekomendacji'
  } else if (reliabilityScore < 62) {
    reason = 'Łączna wiarygodność modelu jest za niska'
  } else if (candidate.edgePp >= threshold + 5 && candidate.expectedValuePct >= 8 && quality >= 88 && reliabilityScore >= 78) {
    decision = 'STRONG_VALUE'
    reason = 'Duża przewaga po usunięciu marży i dobra jakość modelu'
  } else if (candidate.edgePp >= threshold && candidate.expectedValuePct >= 3) {
    decision = 'VALUE'
    reason = 'Przewaga przekracza wymagany próg'
  } else if (candidate.edgePp > 0 && candidate.expectedValuePct > 0) {
    decision = 'SMALL_EDGE'
    reason = 'Dodatnia przewaga, ale poniżej bezpiecznego progu'
  } else {
    reason = 'Brak dodatniej przewagi nad ceną rynkową'
  }
  return { ...candidate, threshold, decision, reason, reliabilityScore, reliabilityLabel }
}

function buildValueEngineV2({ match = {}, data = {}, probabilities = {}, dataQuality = 0, consensus = null, performance = null } = {}) {
  const model = {
    home: Number(probabilities.home || 0), draw: Number(probabilities.draw || 0), away: Number(probabilities.away || 0),
    over15: Number(probabilities.over15 || 0), under15: 100 - Number(probabilities.over15 || 0),
    over25: Number(probabilities.over25 || 0), under25: 100 - Number(probabilities.over25 || 0),
    over35: Number(probabilities.over35 || 0), under35: 100 - Number(probabilities.over35 || 0),
    bttsYes: Number(probabilities.btts || 0), bttsNo: 100 - Number(probabilities.btts || 0)
  }
  const books = Array.isArray(data?.odds?.books) ? data.odds.books : []
  const league = safeTextV158(data?.fixture?.league || match?.league || '', '')
  const candidates = []
  const apiTriplet = normalizeTriplet(data?.prediction?.percent)
  const modelAgreement = apiTriplet ? Math.round(clampNum(100 - ((Math.abs(Number(model.home || 0) - apiTriplet.home) + Math.abs(Number(model.draw || 0) - apiTriplet.draw) + Math.abs(Number(model.away || 0) - apiTriplet.away)) / 3) * 2.2, 35, 98)) : 62
  const context = {
    dataQuality,
    consensusSources: Number(consensus?.consensus?.sourceCount || 0),
    consensusAgreement: Number(consensus?.consensus?.agreement || 0),
    modelAgreement
  }

  const add = (book, key, odd, denominator, marketGroup) => {
    const price = Number(odd || 0)
    const probability = Number(model[key] || 0)
    if (!(price > 1) || !(probability > 0) || !(denominator > 0)) return
    const rawImplied = 100 / price
    const noVigImplied = (1 / price) / denominator * 100
    const margin = (denominator - 1) * 100
    const candidate = {
      key,
      marketGroup,
      probability: round1(probability),
      fairOdds: fairOdd(probability),
      bookmakerOdds: round2(price),
      bookmaker: book?.bookmaker || '',
      rawImplied: round1(rawImplied),
      noVigImplied: round1(noVigImplied),
      bookmakerMargin: round1(margin),
      edgePp: round1(probability - noVigImplied),
      expectedValuePct: round1((probability / 100 * price - 1) * 100),
      vigAdjusted: true,
      calibration: resolveCalibration(performance, league, key, probability)
    }
    candidates.push(classifyValueCandidate(candidate, context))
  }

  for (const book of books) {
    const home = Number(book?.home || 0), draw = Number(book?.draw || 0), away = Number(book?.away || 0)
    if (home > 1 && draw > 1 && away > 1) {
      const denom = 1 / home + 1 / draw + 1 / away
      add(book, 'home', home, denom, '1X2'); add(book, 'draw', draw, denom, '1X2'); add(book, 'away', away, denom, '1X2')
    }
    for (const line of ['15', '25', '35']) {
      const over = Number(book?.[`over${line}`] || 0)
      const under = Number(book?.[`under${line}`] || 0)
      if (over > 1 && under > 1) {
        const denom = 1 / over + 1 / under
        add(book, `over${line}`, over, denom, `O/U ${line[0]}.${line[1]}`)
        add(book, `under${line}`, under, denom, `O/U ${line[0]}.${line[1]}`)
      }
    }
    const yes = Number(book?.bttsYes || 0), no = Number(book?.bttsNo || 0)
    if (yes > 1 && no > 1) {
      const denom = 1 / yes + 1 / no
      add(book, 'bttsYes', yes, denom, 'BTTS'); add(book, 'bttsNo', no, denom, 'BTTS')
    }
  }

  // Fallback: pokaż cenę z listy, ale nie generuj rekomendacji bez pełnej pary
  // kursów potrzebnej do usunięcia marży.
  if (!candidates.length) {
    const legacyMatch = data?.odds?.markets?.length
      ? { ...match, hasRealOdds: true, markets: data.odds.markets }
      : match
    const legacy = extractMarketOdds(legacyMatch)
    Object.entries(legacy).forEach(([legacyKey, quote]) => {
      const key = legacyKey === 'btts' ? 'bttsYes' : legacyKey
      const probability = Number(model[key] || 0)
      const price = Number(quote?.odds || 0)
      if (!probability || !(price > 1)) return
      const raw = 100 / price
      const candidate = {
        key, marketGroup: 'fallback', probability: round1(probability), fairOdds: fairOdd(probability), bookmakerOdds: round2(price), bookmaker: quote?.bookmaker || '',
        rawImplied: round1(raw), noVigImplied: null, bookmakerMargin: null,
        edgePp: round1(probability - raw), expectedValuePct: round1((probability / 100 * price - 1) * 100), vigAdjusted: false,
        calibration: resolveCalibration(performance, league, key, probability)
      }
      candidates.push(classifyValueCandidate(candidate, context))
    })
  }

  const priority = { STRONG_VALUE: 4, VALUE: 3, SMALL_EDGE: 2, NO_BET: 1 }
  const bestByKey = new Map()
  for (const item of candidates) {
    const current = bestByKey.get(item.key)
    const score = (priority[item.decision] || 0) * 1000 + item.edgePp * 10 + item.expectedValuePct
    const currentScore = current ? (priority[current.decision] || 0) * 1000 + current.edgePp * 10 + current.expectedValuePct : -Infinity
    if (!current || score > currentScore) bestByKey.set(item.key, item)
  }
  const ranked = [...bestByKey.values()].sort((a, b) => {
    const pd = (priority[b.decision] || 0) - (priority[a.decision] || 0)
    if (pd) return pd
    return b.edgePp - a.edgePp || b.expectedValuePct - a.expectedValuePct
  })
  const recommendations = ranked.filter(item => ['STRONG_VALUE', 'VALUE'].includes(item.decision))
  const top3 = ranked.slice(0, 3)
  const top = recommendations[0] || top3[0] || null
  const hasCalibrationData = ranked.some(item => Number(item?.calibration?.samples || 0) >= 30)
  let state = 'NO_ODDS'
  if (ranked.length) {
    if (!hasCalibrationData) state = 'CALIBRATION_PENDING'
    else if (recommendations.some(item => item.decision === 'STRONG_VALUE')) state = 'STRONG_VALUE'
    else if (recommendations.length) state = 'VALUE'
    else if (ranked.some(item => item.decision === 'SMALL_EDGE')) state = 'SMALL_EDGE'
    else state = 'NO_BET'
  }
  return {
    version: 'BETAI_VALUE_V2',
    state,
    detected: recommendations.length > 0,
    top,
    top3,
    candidates: ranked.slice(0, 10),
    recommendations: recommendations.slice(0, 3),
    bookmakerCount: books.length,
    marginRemoved: ranked.some(item => item.vigAdjusted),
    calibrationRequiredSamples: 30,
    modelAgreement
  }
}

function buildDataQuality(checks = [], data = {}, consensus = null) {
  const ready = key => Boolean(checks.find(item => item.key === key)?.ready)
  let score = 0
  if (ready('form')) score += 30
  if (ready('teamStats')) score += 35
  if (ready('prediction')) score += 10
  if (ready('h2h')) score += 5
  if (ready('injuries')) score += 5
  if (ready('standings')) score += 5
  if (ready('lineups')) score += 5
  const sourceCount = Number(consensus?.consensus?.sourceCount || 0)
  const agreement = Number(consensus?.consensus?.agreement || 0)
  if (sourceCount > 0) score += Math.min(5, 1 + sourceCount * 0.7 + agreement / 100)
  if (data?.snapshot?.reused && Number(data?.snapshot?.qualityScore || 0) > score) score = Math.max(score, Math.min(100, Number(data.snapshot.qualityScore)))
  return Math.round(clampNum(score, 0, 100))
}

function buildForecast(match = {}, data = {}, consensus = null, checks = [], modelPerformance = null) {
  const stats = data?.teamStats || {}
  const recent = data?.recent || {}
  const prediction = data?.prediction || {}
  const injuries = data?.injuries || {}
  const league = safeTextV158(data?.fixture?.league || match?.league || '', '')

  const homeGF = Number(stats?.home?.goalsForAvg) || avg(recent?.home, 'gf', 1.35)
  const homeGA = Number(stats?.home?.goalsAgainstAvg) || avg(recent?.home, 'ga', 1.18)
  const awayGF = Number(stats?.away?.goalsForAvg) || avg(recent?.away, 'gf', 1.18)
  const awayGA = Number(stats?.away?.goalsAgainstAvg) || avg(recent?.away, 'ga', 1.35)
  const homeForm = formStrength(recent?.home)
  const awayForm = formStrength(recent?.away)
  const apiPercent = normalizeTriplet(prediction?.percent)
  const webPercent = consensus?.consensus?.available ? normalizeTriplet(consensus.consensus.percent) : null

  const attackHome = Number(prediction?.comparison?.attack?.home ?? prediction?.comparison?.att?.home ?? 50) || 50
  const attackAway = Number(prediction?.comparison?.attack?.away ?? prediction?.comparison?.att?.away ?? 50) || 50
  const defenceHome = Number(prediction?.comparison?.defence?.home ?? prediction?.comparison?.def?.home ?? 50) || 50
  const defenceAway = Number(prediction?.comparison?.defence?.away ?? prediction?.comparison?.def?.away ?? 50) || 50

  let homeXg = 0.44 * homeGF + 0.34 * awayGA + 0.22 * 1.35
  let awayXg = 0.44 * awayGF + 0.34 * homeGA + 0.22 * 1.15
  homeXg += (homeForm - awayForm) * 0.004 + (attackHome - defenceAway) * 0.006 + 0.12
  awayXg += (awayForm - homeForm) * 0.004 + (attackAway - defenceHome) * 0.006
  homeXg -= clampNum(Number(injuries?.homeCount || 0) * 0.035, 0, 0.22)
  awayXg -= clampNum(Number(injuries?.awayCount || 0) * 0.035, 0, 0.22)

  const h2hAvg = Number(data?.h2h?.summary?.avgGoals || 0)
  if (h2hAvg > 0) {
    const total = Math.max(0.5, homeXg + awayXg)
    const target = clampNum(total * 0.8 + h2hAvg * 0.2, 1.1, 4.5)
    const scale = target / total
    homeXg *= scale
    awayXg *= scale
  }

  const externalOver25 = Number(consensus?.goals?.over25 || 0)
  const externalGoalSources = Number(consensus?.goals?.sourceCount || 0)
  if (consensus?.goals?.available && externalOver25 > 0 && externalGoalSources > 0) {
    const delta = clampNum((externalOver25 - 50) * 0.009, -0.28, 0.28)
    const total = Math.max(0.5, homeXg + awayXg)
    const target = clampNum(total + delta, 1.0, 4.8)
    const scale = target / total
    homeXg *= scale
    awayXg *= scale
  }

  homeXg = clampNum(homeXg, 0.22, 3.6)
  awayXg = clampNum(awayXg, 0.18, 3.4)
  const poisson = poissonForecast(homeXg, awayXg)

  // V143 — weights are dynamic. Statistics remain the primary independent source;
  // API/web weight rises only when the source is present and agrees reasonably.
  const sourceWeights = dynamicSourceWeightsV143({ data, consensus, performance: modelPerformance, league, poisson, apiPercent, webPercent })
  const oneXTwoRaw = weightedTriplet([
    { value: poisson.oneXTwo, weight: sourceWeights.stats },
    { value: apiPercent, weight: sourceWeights.api },
    { value: webPercent, weight: sourceWeights.web }
  ]) || poisson.oneXTwo

  const goalsWebWeight = consensus?.goals?.available && externalGoalSources > 0
    ? clampNum((sourceWeights.web / 100) * 0.85, 0.05, 0.24, 0.12)
    : 0
  const over25Raw = goalsWebWeight > 0 ? poisson.over25 * (1 - goalsWebWeight) + externalOver25 * goalsWebWeight : poisson.over25
  const externalBtts = Number(consensus?.goals?.bttsYes || 0)
  const bttsWeight = consensus?.goals?.bttsAvailable && externalBtts > 0 ? Math.min(0.20, goalsWebWeight || 0.10) : 0
  const bttsRaw = bttsWeight > 0 ? poisson.btts * (1 - bttsWeight) + externalBtts * bttsWeight : poisson.btts

  const championRawMarkets = {
    home: round1(oneXTwoRaw.home),
    draw: round1(oneXTwoRaw.draw),
    away: round1(oneXTwoRaw.away),
    over15: round1(poisson.over15),
    over25: round1(over25Raw),
    over35: round1(poisson.over35),
    btts: round1(bttsRaw)
  }
  const championVariant = {
    version: 'BETAI_CHAMPION_V158_CORE',
    oneXTwo: { home: championRawMarkets.home, draw: championRawMarkets.draw, away: championRawMarkets.away },
    goals: { over15: championRawMarkets.over15, over25: championRawMarkets.over25, over35: championRawMarkets.over35, btts: championRawMarkets.btts },
    xg: { home: round2(homeXg), away: round2(awayXg) }
  }
  const challengerVariant = buildChallengerRawV180({ match, data, consensus, champion: championVariant, performance: modelPerformance })
  const modelSelection = chooseActiveModelV173(modelPerformance)
  const challengerActive = modelSelection.activeModel === 'challenger'
  const activeOneXTwoRaw = challengerActive ? challengerVariant.oneXTwo : oneXTwoRaw
  const rawMarkets = challengerActive ? {
    home: round1(challengerVariant.oneXTwo.home),
    draw: round1(challengerVariant.oneXTwo.draw),
    away: round1(challengerVariant.oneXTwo.away),
    over15: round1(challengerVariant.goals.over15),
    over25: round1(challengerVariant.goals.over25),
    over35: round1(challengerVariant.goals.over35),
    btts: round1(challengerVariant.goals.btts)
  } : championRawMarkets

  // V160/V166 — Champion remains active until the Challenger has enough paired,
  // settled history and proves a lower Brier Score. Calibration is applied only
  // after model selection, so Value Engine never mixes future outcome data.
  const oneCalibration = calibrateTripletV2(modelPerformance, league, activeOneXTwoRaw)
  const goalCals = {
    over15: calibrateProbabilityV2(modelPerformance, league, 'over15', rawMarkets.over15),
    over25: calibrateProbabilityV2(modelPerformance, league, 'over25', rawMarkets.over25),
    over35: calibrateProbabilityV2(modelPerformance, league, 'over35', rawMarkets.over35),
    btts: calibrateProbabilityV2(modelPerformance, league, 'bttsYes', rawMarkets.btts)
  }
  const adaptiveOne = adaptiveCalibrateTripletV172(modelPerformance, league, oneCalibration.calibrated || activeOneXTwoRaw)
  const adaptiveGoals = {
    over15: adaptiveCalibrateBinaryV172(modelPerformance, league, 'over15', goalCals.over15.calibrated),
    over25: adaptiveCalibrateBinaryV172(modelPerformance, league, 'over25', goalCals.over25.calibrated),
    over35: adaptiveCalibrateBinaryV172(modelPerformance, league, 'over35', goalCals.over35.calibrated),
    btts: adaptiveCalibrateBinaryV172(modelPerformance, league, 'btts', goalCals.btts.calibrated)
  }
  const markets = {
    home: round1(adaptiveOne.calibrated?.home ?? oneCalibration.calibrated?.home ?? rawMarkets.home),
    draw: round1(adaptiveOne.calibrated?.draw ?? oneCalibration.calibrated?.draw ?? rawMarkets.draw),
    away: round1(adaptiveOne.calibrated?.away ?? oneCalibration.calibrated?.away ?? rawMarkets.away),
    over15: adaptiveGoals.over15.calibrated,
    over25: adaptiveGoals.over25.calibrated,
    over35: adaptiveGoals.over35.calibrated,
    btts: adaptiveGoals.btts.calibrated
  }
  const fair = Object.fromEntries(Object.entries(markets).map(([key, value]) => [key, fairOdd(value)]))
  const dataQuality = buildDataQuality(checks, data, consensus)
  const sourceCount = Number(consensus?.consensus?.sourceCount || 0)
  const agreement = Number(consensus?.consensus?.agreement || 0)
  const valueEngine = buildValueEngineV2({
    match,
    data,
    probabilities: markets,
    dataQuality,
    consensus,
    performance: modelPerformance
  })

  const factors = [
    `Forma: ${Math.round(homeForm)}–${Math.round(awayForm)}`,
    `Gole/mecz: ${round2(homeGF)}–${round2(awayGF)}`,
    `Tracone/mecz: ${round2(homeGA)}–${round2(awayGA)}`
  ]
  if (data?.h2h?.summary?.count) factors.push(`H2H: ${data.h2h.summary.count} meczów • śr. ${round2(data.h2h.summary.avgGoals)} gola`)
  if (sourceCount) factors.push(`Web consensus: ${sourceCount} źródeł • zgodność ${Math.round(agreement)}%`)

  const forecast = {
    version: 'BETAI_FORECAST_V180',
    calibrationVersion: 'BETAI_ADAPTIVE_CALIBRATION_V172',
    weightingVersion: 'BETAI_SELF_LEARNING_WEIGHTS_V167_170',
    predictionEngineVersion: 'BETAI_PREDICTION_ENGINE_3_V180',
    activeModel: modelSelection.activeModel,
    modelSelection,
    modelVariants: { champion: championVariant, challenger: challengerVariant },
    generatedAt: new Date().toISOString(),
    fixtureId: String(match?.apiFixtureId || match?.id || data?.fixture?.id || ''),
    xg: { home: round2(challengerActive ? challengerVariant?.xg?.home : homeXg), away: round2(challengerActive ? challengerVariant?.xg?.away : awayXg) },
    raw: {
      oneXTwo: { home: rawMarkets.home, draw: rawMarkets.draw, away: rawMarkets.away },
      goals: { over15: rawMarkets.over15, over25: rawMarkets.over25, over35: rawMarkets.over35, btts: rawMarkets.btts }
    },
    oneXTwo: { home: markets.home, draw: markets.draw, away: markets.away },
    goals: { over15: markets.over15, over25: markets.over25, over35: markets.over35, btts: markets.btts },
    fairOdds: fair,
    calibration: {
      oneXTwo: oneCalibration,
      over15: goalCals.over15,
      over25: goalCals.over25,
      over35: goalCals.over35,
      btts: goalCals.btts,
      adaptive: { oneXTwo: adaptiveOne, goals: adaptiveGoals }
    },
    sourceWeights,
    topScores: (challengerActive ? challengerVariant?.dixonColes?.topScores || [] : poisson.topScores).slice(0, 3).map(item => ({ score: item.score, probability: round1(item.probability) })),
    dataQuality,
    consensus: { sourceCount, agreement: Math.round(agreement), available: Boolean(webPercent) },
    value: valueEngine,
    factors,
    modelInputs: { homeGF: round2(homeGF), homeGA: round2(homeGA), awayGF: round2(awayGF), awayGA: round2(awayGA), homeForm: Math.round(homeForm), awayForm: Math.round(awayForm), matchIntelligence: challengerVariant?.matchIntelligence || null }
  }
  forecast.explainability = explainForecastV145({ match, data, consensus, forecast, homeGF, homeGA, awayGF, awayGA, homeForm, awayForm })
  return forecast
}

function forecastLabel(key) {
  return ({ home: '1 • Gospodarze', draw: 'X • Remis', away: '2 • Goście', over15: 'Over 1.5', under15: 'Under 1.5', over25: 'Over 2.5', under25: 'Under 2.5', over35: 'Over 3.5', under35: 'Under 3.5', btts: 'BTTS TAK', bttsYes: 'BTTS TAK', bttsNo: 'BTTS NIE' })[key] || key
}

function pause(ms) {
  return new Promise(resolve => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function isRateLimitError(response, payload = {}) {
  return response?.status === 429 || Boolean(payload?.rateLimited) || /429|too many requests|rate limit|requests per minute/i.test(String(payload?.error || payload?.message || ''))
}

function friendlyPreparationError(message = '') {
  const text = String(message || '')
  if (/429|too many requests|rate limit|requests per minute/i.test(text)) return 'API-Football jest chwilowo zajęte. Rate Limit Shield spróbuje ponownie automatycznie.'
  return text || 'Nie udało się pobrać danych symulacji'
}

function valueDecisionLabel(value = '') {
  return ({ STRONG_VALUE: 'STRONG VALUE', VALUE: 'VALUE', SMALL_EDGE: 'SMALL EDGE', NO_BET: 'NO BET', CALIBRATION_PENDING: 'KALIBRACJA', NO_ODDS: 'BRAK KURSÓW' })[String(value || '').toUpperCase()] || String(value || '').replaceAll('_', ' ')
}


function reliabilityCalibrationScore(calibration = {}) {
  const status = String(calibration?.status || 'PENDING').toUpperCase()
  let score = status === 'GOOD' ? 94 : status === 'OK' ? 78 : status === 'POOR' ? 28 : 45
  const samples = Number(calibration?.samples || 0)
  if (samples >= 100) score += 4
  else if (samples >= 50) score += 2
  return Math.round(clampNum(score, 0, 100))
}

function buildReliabilityEngine({ match = {}, data = {}, forecast = null, consensus = null, performance = null } = {}) {
  if (!forecast) return null
  const quality = Number(forecast?.dataQuality || 0)
  const apiPercent = normalizeTriplet(data?.prediction?.percent)
  const modelPercent = forecast?.oneXTwo || {}
  let modelAgreement = 62
  if (apiPercent) {
    const diff = (Math.abs(Number(modelPercent.home || 0) - apiPercent.home) + Math.abs(Number(modelPercent.draw || 0) - apiPercent.draw) + Math.abs(Number(modelPercent.away || 0) - apiPercent.away)) / 3
    modelAgreement = Math.round(clampNum(100 - diff * 2.2, 35, 98))
  }

  const candidate = forecast?.value?.top3?.[0] || forecast?.value?.top || null
  const fallbackProbability = Math.max(Number(forecast?.goals?.over25 || 0), 100 - Number(forecast?.goals?.over25 || 0))
  const calibration = candidate?.calibration || resolveCalibration(performance, safeTextV158(data?.fixture?.league || match?.league || '', ''), candidate?.key || 'over25', candidate?.probability || fallbackProbability)
  const calibrationScore = reliabilityCalibrationScore(calibration)

  const sourceCount = Number(consensus?.consensus?.sourceCount || 0)
  const consensusAgreement = consensus?.consensus?.available ? Number(consensus?.consensus?.agreement || 0) : 55
  const sourceScore = Math.round(clampNum(62 + Math.min(5, sourceCount) * 6 + (data?.prediction?.available ? 7 : 0) + (data?.teamStats?.home?.available && data?.teamStats?.away?.available ? 8 : 0), 0, 100))
  const bookmakerCount = Number(data?.odds?.books?.length || 0)
  const marketDepth = bookmakerCount >= 5 ? 96 : bookmakerCount >= 3 ? 90 : bookmakerCount >= 1 ? 78 : 45

  let score = Math.round(quality * 0.35 + modelAgreement * 0.20 + calibrationScore * 0.25 + consensusAgreement * 0.10 + marketDepth * 0.10)
  if (calibration?.status === 'POOR') score = Math.min(score, 59)
  score = Math.round(clampNum(score, 0, 100))

  let label = score >= 82 ? 'HIGH' : score >= 68 ? 'MEDIUM' : 'LOW'
  let decisionSupport = label === 'HIGH' ? 'Model ma mocne podstawy do wspierania decyzji.' : label === 'MEDIUM' ? 'Model jest użyteczny, ale wymaga ostrożniejszego progu value.' : 'Nie traktuj tego meczu jako mocnej rekomendacji.'
  if (Number(calibration?.samples || 0) < 30) {
    label = 'PENDING'
    decisionSupport = `Kalibracja historyczna ma ${Number(calibration?.samples || 0)}/30 wymaganych prób.`
  }
  if (calibration?.status === 'POOR') {
    label = 'LOW'
    decisionSupport = 'Historyczna kalibracja tego rynku jest zbyt słaba dla mocnej rekomendacji.'
  }

  return {
    version: 'BETAI_RELIABILITY_V1', score, label, decisionSupport,
    components: {
      dataQuality: Math.round(quality),
      modelAgreement,
      calibration: calibrationScore,
      consensus: Math.round(clampNum(consensusAgreement, 0, 100)),
      marketDepth
    },
    calibration: {
      status: calibration?.status || 'PENDING', samples: Number(calibration?.samples || 0),
      brier: Number(calibration?.brier || 0), source: calibration?.source || 'global', gap: calibration?.bucket?.gap ?? null
    },
    sourceCount,
    bookmakerCount

  }
}

function isBetAiLabTestV152(match = {}) {
  return Boolean(match?.isBetAiLabTest || String(match?.id || '') === 'betai-lab-test-v152')
}

function makeTestLineupV152(prefix = 'HOME', tone = 'home') {
  const grids = ['1:1','2:1','2:2','2:3','2:4','3:1','3:2','3:3','4:1','4:2','4:3']
  const positions = ['G','D','D','D','D','M','M','M','F','F','F']
  const numbers = tone === 'home' ? [1,2,4,5,3,6,8,10,7,9,11] : [1,2,3,4,5,6,8,10,7,9,11]
  return {
    formation: '4-3-3', official: false, predicted: true, predictionConfidence: 82,
    predictionSource: 'betai-lab-test', sourceMatches: 8,
    coach: { name: 'Bet+AI Lab' },
    colors: tone === 'home'
      ? { player: { primary: '20d8dc', number: '06151d', border: 'eaffff' }, goalkeeper: { primary: 'f2cf45', number: '07131b', border: 'ffffff' } }
      : { player: { primary: '5178ef', number: 'ffffff', border: 'f5f8ff' }, goalkeeper: { primary: 'f2cf45', number: '07131b', border: 'ffffff' } },
    startXI: grids.map((grid, index) => ({
      id: `${tone}-${index + 1}`,
      name: `${prefix} ${['Keeper','Right','Centre A','Centre B','Left','Anchor','Eight','Creator','Wing R','Striker','Wing L'][index]}`,
      number: numbers[index], pos: positions[index], grid
    })),
    substitutes: Array.from({ length: 7 }, (_, index) => ({ id: `${tone}-sub-${index + 1}`, name: `${prefix} Rezerwowy ${index + 1}`, number: 12 + index, pos: index < 2 ? 'D' : index < 5 ? 'M' : 'F' }))
  }
}

function buildBetAiLabTestDataV152(match = {}) {
  const recentHome = [
    { gf: 2, ga: 0, result: 'W' }, { gf: 2, ga: 1, result: 'W' }, { gf: 1, ga: 1, result: 'D' }, { gf: 3, ga: 1, result: 'W' },
    { gf: 1, ga: 0, result: 'W' }, { gf: 2, ga: 2, result: 'D' }, { gf: 1, ga: 2, result: 'L' }, { gf: 3, ga: 0, result: 'W' }
  ]
  const recentAway = [
    { gf: 1, ga: 1, result: 'D' }, { gf: 2, ga: 1, result: 'W' }, { gf: 0, ga: 1, result: 'L' }, { gf: 2, ga: 2, result: 'D' },
    { gf: 1, ga: 2, result: 'L' }, { gf: 2, ga: 0, result: 'W' }, { gf: 1, ga: 1, result: 'D' }, { gf: 0, ga: 2, result: 'L' }
  ]
  const fixtureDate = match?.fixture_date || match?.commence_time || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'BET+AI LAB TEST • OFFLINE • 0 API REQUESTS',
    apiAvailable: false,
    partial: false,
    errors: [],
    fixture: {
      id: 'betai-lab-test-v152', date: fixtureDate, league: 'BET+AI PROFESSIONAL LAB', country: 'TEST 0 API', round: 'Scenariusz kontrolny',
      home: { id: 'lab-home', name: match?.home || 'BET+AI Home', logo: '' },
      away: { id: 'lab-away', name: match?.away || 'BET+AI Away', logo: '' }
    },
    prediction: {
      available: true,
      percent: { home: 57, draw: 25, away: 18 },
      comparison: { attack: { home: 64, away: 51 }, defence: { home: 61, away: 48 } },
      advice: 'TEST: scenariusz laboratoryjny do sprawdzenia interfejsu i logiki bez API.',
      underOver: 'Over 2.5'
    },
    h2h: { available: true, summary: { count: 6, homeWins: 3, draws: 2, awayWins: 1, avgGoals: 2.83 } },
    injuries: { available: true, homeCount: 1, awayCount: 2, items: [{ teamId: 'lab-home', team: 'BET+AI Home', player: 'HOME Creator', type: 'Test', reason: 'Offline test absence' }, { teamId: 'lab-away', team: 'BET+AI Away', player: 'AWAY Right', type: 'Test', reason: 'Offline test absence' }, { teamId: 'lab-away', team: 'BET+AI Away', player: 'AWAY Wing L', type: 'Test', reason: 'Offline test absence' }] },
    lineups: { available: true, home: makeTestLineupV152('HOME', 'home'), away: makeTestLineupV152('AWAY', 'away') },
    standings: { available: true, home: { rank: 3, points: 54 }, away: { rank: 8, points: 41 } },
    recent: { home: recentHome, away: recentAway },
    teamStats: {
      home: { available: true, source: 'recent-fixtures', sampleSize: 8, goalsForAvg: 1.88, goalsAgainstAvg: 0.88 },
      away: { available: true, source: 'recent-fixtures', sampleSize: 8, goalsForAvg: 1.13, goalsAgainstAvg: 1.25 }
    },
    odds: {
      available: true,
      books: [
        { bookmaker: 'BET+AI TEST BOOK', home: 1.98, draw: 3.65, away: 4.25, over15: 1.30, under15: 3.55, over25: 1.92, under25: 1.96, over35: 3.05, under35: 1.40, bttsYes: 1.91, bttsNo: 1.94 },
        { bookmaker: 'LAB MARKET', home: 2.02, draw: 3.55, away: 4.10, over15: 1.31, under15: 3.45, over25: 1.95, under25: 1.93, over35: 3.10, under35: 1.39, bttsYes: 1.93, bttsNo: 1.92 }
      ],
      markets: []
    },
    rateLimitShield: { cachedResponses: 1, staleFallbacks: 0, rateLimited: false, budgetLimited: false },
    simulationQuality: { score: 100, eligible: true, reasons: [], warnings: ['TRYB TESTOWY — dane kontrolne, nie używać jako realnej rekomendacji.'], checks: { form: true, teamStats: true, injuries: true, lineups: true, prediction: true } },
    snapshot: { enabled: false, reused: true, fallback: false, source: 'offline-test', qualityScore: 100, eligible: true, note: 'TRYB TESTOWY V152 • 0 requestów API • dane kontrolne nie trafiają do backtestu.' }
  }
}

function testMarketSummaryV152(key, label, samples = 180, accuracy = 64, brier = 0.218) {
  return {
    key, label, samples, accuracy, brier, avgConfidence: 64,
    calibration: [
      { range: '50-55%', samples: 32, avgConfidence: 52.8, actualAccuracy: 53.1, calibrationGap: 0.3 },
      { range: '55-60%', samples: 38, avgConfidence: 57.4, actualAccuracy: 58.2, calibrationGap: 0.8 },
      { range: '60-65%', samples: 44, avgConfidence: 62.1, actualAccuracy: 63.6, calibrationGap: 1.5 },
      { range: '65-70%', samples: 36, avgConfidence: 67.2, actualAccuracy: 66.7, calibrationGap: -0.5 },
      { range: '70-75%', samples: 30, avgConfidence: 72.0, actualAccuracy: 70.0, calibrationGap: -2.0 }
    ]
  }
}

function buildBetAiLabTestPerformanceV152() {
  const markets = [
    testMarketSummaryV152('oneXTwo', '1X2', 420, 58.3, 0.229),
    testMarketSummaryV152('over15', 'Over 1.5', 398, 72.1, 0.184),
    testMarketSummaryV152('over25', 'Over 2.5', 392, 64.0, 0.213),
    testMarketSummaryV152('over35', 'Over 3.5', 374, 67.1, 0.205),
    testMarketSummaryV152('btts', 'BTTS', 386, 62.4, 0.219)
  ]
  const league = { name: 'BET+AI PROFESSIONAL LAB', matches: 210, markets, avgBrier: 0.210, oneXTwoAccuracy: 58.3 }
  return {
    ok: true, available: true, isDemoPerformance: true,
    all: { matches: 420, markets, avgBrier: 0.211, rawAvgBrier: 0.226, calibrationBrierLift: 0.015, oneXTwoAccuracy: 58.3, valueRoi: 7.8, valueBets: 128, avgClv: 3.6, clvSamples: 81, calibration: markets[2].calibration },
    last30: { matches: 96, avgBrier: 0.207, valueRoi: 5.9 },
    leagues: [league],
    versions: [{ name: 'BETAI_FORECAST_V180', matches: 210, avgBrier: 0.204 }],
    walkForward: {
      samples: 350, rawBrier: 0.228, walkForwardBrier: 0.209, lift: 0.019,
      markets: [
        { key: 'oneXTwo', samples: 330, rawBrier: 0.241, walkForwardBrier: 0.229, lift: 0.012 },
        { key: 'over15', samples: 342, rawBrier: 0.196, walkForwardBrier: 0.181, lift: 0.015 },
        { key: 'over25', samples: 338, rawBrier: 0.229, walkForwardBrier: 0.207, lift: 0.022 },
        { key: 'over35', samples: 322, rawBrier: 0.222, walkForwardBrier: 0.205, lift: 0.017 },
        { key: 'btts', samples: 331, rawBrier: 0.232, walkForwardBrier: 0.215, lift: 0.017 }
      ]
    },
    drift: {
      markets: [
        { key: 'oneXTwo', status: 'STABLE', score: 88, windows: { w30: { samples: 30, brier: 0.224, accuracy: 60 }, w50: { samples: 50, brier: 0.228, accuracy: 58 }, w100: { samples: 100, brier: 0.231, accuracy: 58 } } },
        { key: 'over15', status: 'STABLE', score: 91, windows: { w30: { samples: 30, brier: 0.177, accuracy: 73 }, w50: { samples: 50, brier: 0.182, accuracy: 72 }, w100: { samples: 100, brier: 0.185, accuracy: 71 } } },
        { key: 'over25', status: 'STABLE', score: 90, windows: { w30: { samples: 30, brier: 0.205, accuracy: 67 }, w50: { samples: 50, brier: 0.210, accuracy: 64 }, w100: { samples: 100, brier: 0.214, accuracy: 63 } } },
        { key: 'over35', status: 'WATCH', score: 72, windows: { w30: { samples: 30, brier: 0.226, accuracy: 63 }, w50: { samples: 50, brier: 0.218, accuracy: 66 }, w100: { samples: 100, brier: 0.207, accuracy: 67 } } },
        { key: 'btts', status: 'STABLE', score: 85, windows: { w30: { samples: 30, brier: 0.214, accuracy: 63 }, w50: { samples: 50, brier: 0.218, accuracy: 62 }, w100: { samples: 100, brier: 0.220, accuracy: 62 } } }
      ]
    },
    leagueTrust: [{ name: 'BET+AI PROFESSIONAL LAB', overallScore: 87, label: 'HIGH', markets: [
      { key: 'oneXTwo', score: 78, label: 'GOOD', samples: 210 }, { key: 'over15', score: 92, label: 'HIGH', samples: 198 },
      { key: 'over25', score: 89, label: 'HIGH', samples: 196 }, { key: 'over35', score: 74, label: 'GOOD', samples: 187 }, { key: 'btts', score: 84, label: 'HIGH', samples: 193 }
    ] }],
    paperPortfolio: { bets: 128, settled: 116, pending: 12, wins: 67, losses: 49, profitUnits: 9.05, roi: 7.8, yield: 7.8, maxDrawdownUnits: 7.2, maxWinStreak: 8, maxLoseStreak: 5, avgClv: 3.6, clvSamples: 81 },
    errorAnalysis: { analyzed: 420, losingPredictions: 141, errorRatePct: 33.6, categories: [
      { key: 'NORMAL_VARIANCE', label: 'Normalna wariancja wyniku', count: 53, sharePct: 37.6 },
      { key: 'SOURCE_CONFLICT', label: 'Źródła były rozbieżne', count: 31, sharePct: 22.0 },
      { key: 'OVERCONFIDENCE', label: 'Model był zbyt pewny', count: 24, sharePct: 17.0 }
    ], recentErrors: [] },
    portfolioRisk: { settled: 116, roi: 7.8, profitUnits: 9.05, volatilityUnits: 0.96, maxDrawdownUnits: 7.2, maxDrawdownAtBet: 74, riskScore: 47, level: 'LOW', concentration: { hhi: 0.24, largestMarket: { key: 'over25', count: 34, sharePct: 29.3 }, markets: [] }, rolling: {
      w50: { size: 50, windows: 67, medianRoi: 7.2, p25Roi: 2.1, worstRoi: -8.4, bestRoi: 21.3, positiveRate: 73.1 },
      w100: { size: 100, windows: 17, medianRoi: 7.7, p25Roi: 4.1, worstRoi: 1.2, bestRoi: 13.9, positiveRate: 100 },
      w250: { size: 250, windows: 1, medianRoi: 7.8, p25Roi: 7.8, worstRoi: 7.8, bestRoi: 7.8, positiveRate: 100 }
    } },
    championChallenger: {
      version: 'BETAI_CHAMPION_CHALLENGER_V160', activeModel: 'challenger', status: 'CHALLENGER_PROMOTED', pairedSamples: 142, requiredSamples: 100, promotionBrierLift: 0.005, brierDelta: 0.009,
      reason: 'TEST: Challenger ma niższy Brier w 142 sparowanych prognozach.',
      champion: { version: 'BETAI_CHAMPION_V158_CORE', matches: 142, avgBrier: 0.219, accuracy: 63.1 },
      challenger: { version: 'BETAI_CHALLENGER_V166_DC_STRENGTH', matches: 142, avgBrier: 0.210, accuracy: 65.0 }, marketRegressions: []
    },
    statisticalConfidence: { version: 'BETAI_STAT_CONFIDENCE_V161', markets: markets.map(item => ({ key: item.key, label: item.label, samples: item.samples, accuracy: item.accuracy, brier: item.brier, accuracy95: { low: Math.max(0, item.accuracy - 5.2), high: Math.min(100, item.accuracy + 5.2) }, level: item.samples >= 250 ? 'HIGH' : 'MEDIUM' })), portfolio: { samples: 116, roi: 7.8, roi95: { low: 1.1, high: 14.5 }, standardDeviationUnits: 0.96, level: 'MEDIUM' } },
    autoGate: { version: 'BETAI_AUTO_GATE_V162', blocked: [], watch: ['over35'], markets: [
      { key: 'oneXTwo', label: '1X2', status: 'ACTIVE', reason: 'Stabilna historia.', samples: 420, brier: 0.229, driftStatus: 'STABLE', trustScore: 78 },
      { key: 'over15', label: 'Over 1.5', status: 'ACTIVE', reason: 'Stabilna historia.', samples: 398, brier: 0.184, driftStatus: 'STABLE', trustScore: 92 },
      { key: 'over25', label: 'Over 2.5', status: 'ACTIVE', reason: 'Stabilna historia.', samples: 392, brier: 0.213, driftStatus: 'STABLE', trustScore: 89 },
      { key: 'over35', label: 'Over 3.5', status: 'WATCH', reason: 'Rynek ma status DRIFT WATCH.', samples: 374, brier: 0.205, driftStatus: 'WATCH', trustScore: 74 },
      { key: 'btts', label: 'BTTS', status: 'ACTIVE', reason: 'Stabilna historia.', samples: 386, brier: 0.219, driftStatus: 'STABLE', trustScore: 84 }
    ] },
    teamStrength: { version: 'BETAI_TEAM_STRENGTH_V164', method: 'TEST opponent-adjusted Elo', trackedTeams: 128, teams: [] },
    selfLearning: {
      version: 'BETAI_SELF_LEARNING_ENGINE_V174', samples: 130, recency: { halfLifeDays: 90, method: 'exponential-decay' },
      globalWeights: { poisson: 1.02, dixonColes: 1.48, form: 0.86, api: 0.72, web: 0.41, teamStrength: 1.12, recent: 0.69 },
      marketProfiles: [], leagueProfiles: [{ league: 'BET+AI PROFESSIONAL LAB', samples: 130, markets: [] }],
      featureLab: [
        { source: 'dixonColes', rank: 1, samples: 130, brier: 0.188, status: 'PROVEN' },
        { source: 'teamStrength', rank: 2, samples: 130, brier: 0.199, status: 'PROVEN' },
        { source: 'poisson', rank: 3, samples: 130, brier: 0.207, status: 'PROVEN' },
        { source: 'form', rank: 4, samples: 130, brier: 0.221, status: 'PROVEN' }
      ],
      adaptiveCalibration: { version: 'BETAI_ADAPTIVE_CALIBRATION_V172', marketProfiles: [], leagueProfiles: [] },
      governance: { version: 'BETAI_MODEL_GOVERNANCE_V173', activeVersion: 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL', previousVersion: 'BETAI_CHAMPION_V158_CORE', status: 'AUTO_PROMOTED', reason: 'TEST: V180 przeszedł próg 120 par.', pairedSamples: 130, requiredSamples: 120, brierDelta: 0.008, rollbackArmed: true, champion: { matches: 130, avgBrier: 0.219 }, challenger: { matches: 130, avgBrier: 0.211 } }
    },
    modelGovernance: { activeVersion: 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL', status: 'AUTO_PROMOTED', pairedSamples: 130, requiredSamples: 120, brierDelta: 0.008, rollbackArmed: true, champion: { matches: 130, avgBrier: 0.219 }, challenger: { matches: 130, avgBrier: 0.211 } },
    controlCenter: { version: 'BETAI_MODEL_CONTROL_V166', health: 'HEALTHY', alerts: ['Over 3.5 ma status WATCH — obserwuj drift.', 'TEST: Challenger został promowany po paired validation.'], settledPredictions: 420, brier: 0.211, last30Brier: 0.207, shadowRoi: 7.8, avgClv: 3.6, driftCount: 0, watchCount: 1, bestLeague: { name: 'BET+AI PROFESSIONAL LAB', score: 87, matches: 210 }, worstLeague: null, bestMarket: { key: 'over15', label: 'Over 1.5', brier: 0.184, samples: 398 }, worstMarket: { key: 'oneXTwo', label: '1X2', brier: 0.229, samples: 420 }, activeModelVersion: 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL', activeModel: 'challenger', championChallengerStatus: 'CHALLENGER_PROMOTED', statConfidence: 'MEDIUM', blockedMarkets: [] }
  }
}

function buildBetAiLabConsensusV152() {
  return {
    ok: true, enabled: true, isTest: true,
    consensus: { available: true, percent: { home: 55, draw: 26, away: 19 }, sourceCount: 5, agreement: 78, confidence: 78, summary: 'TEST consensus • dane kontrolne offline.' },
    goals: { available: true, over25: 64, under25: 36, sourceCount: 4, confidence: 76, bttsAvailable: true, bttsYes: 57, bttsNo: 43 },
    sources: [], sourceRegistry: []
  }
}

function rawProbabilityForKeyV152(forecast = {}, key = '') {
  if (['home','draw','away'].includes(key)) return Number(forecast?.raw?.oneXTwo?.[key] || forecast?.oneXTwo?.[key] || 0)
  if (key === 'over15') return Number(forecast?.raw?.goals?.over15 || forecast?.goals?.over15 || 0)
  if (key === 'under15') return 100 - Number(forecast?.raw?.goals?.over15 || forecast?.goals?.over15 || 0)
  if (key === 'over25') return Number(forecast?.raw?.goals?.over25 || forecast?.goals?.over25 || 0)
  if (key === 'under25') return 100 - Number(forecast?.raw?.goals?.over25 || forecast?.goals?.over25 || 0)
  if (key === 'over35') return Number(forecast?.raw?.goals?.over35 || forecast?.goals?.over35 || 0)
  if (key === 'under35') return 100 - Number(forecast?.raw?.goals?.over35 || forecast?.goals?.over35 || 0)
  if (['btts','bttsYes'].includes(key)) return Number(forecast?.raw?.goals?.btts || forecast?.goals?.btts || 0)
  if (key === 'bttsNo') return 100 - Number(forecast?.raw?.goals?.btts || forecast?.goals?.btts || 0)
  return 0
}

function findLeagueTrustV150(performance = null, league = '', key = '') {
  const leagueRow = Array.isArray(performance?.leagueTrust)
    ? performance.leagueTrust.find(item => normalizeName(item?.name) === normalizeName(league)) || null
    : null
  const marketKey = performanceMarketKey(key)
  const market = leagueRow?.markets?.find(item => item?.key === marketKey) || null
  if (market) return market
  if (leagueRow) return { key: marketKey, score: Number(leagueRow.overallScore || 50), label: leagueRow.label || 'PENDING', samples: Number(leagueRow.matches || 0) }
  return { key: marketKey, score: 50, label: 'PENDING', samples: 0 }
}

function findDriftV149(performance = null, key = '') {
  const marketKey = performanceMarketKey(key)
  return performance?.drift?.markets?.find(item => item?.key === marketKey) || { key: marketKey, status: 'PENDING', score: 50, windows: {} }
}

function findWalkForwardV147(performance = null, key = '') {
  const marketKey = performanceMarketKey(key)
  return performance?.walkForward?.markets?.find(item => item?.key === marketKey) || { key: marketKey, samples: 0, rawBrier: 0, walkForwardBrier: 0, lift: 0 }
}

function findClvForCandidateV152(oddsHistory = null, candidate = null) {
  if (!candidate || !Array.isArray(oddsHistory?.markets)) return null
  const exact = oddsHistory.markets.find(item => item?.marketKey === candidate.key && normalizeName(item?.bookmaker) === normalizeName(candidate?.bookmaker))
  const fallback = oddsHistory.markets.find(item => item?.marketKey === candidate.key)
  return exact || fallback || null
}



function safeTextV158(value, fallback = '') {
  if (value == null || value === '') return fallback
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    if (value.name != null) return safeTextV158(value.name, fallback)
    if (value.label != null) return safeTextV158(value.label, fallback)
    if (value.value != null) return safeTextV158(value.value, fallback)
  }
  return fallback
}

function recentBinaryProbabilityV155(data = {}, key = 'over25') {
  const rows = [...(data?.recent?.home || []), ...(data?.recent?.away || [])]
  if (!rows.length) return null
  let yes = 0, count = 0
  for (const row of rows) {
    const gf = Number(row?.gf), ga = Number(row?.ga)
    if (!Number.isFinite(gf) || !Number.isFinite(ga)) continue
    const total = gf + ga
    let hit = false
    if (key === 'over15') hit = total >= 2
    else if (key === 'over25') hit = total >= 3
    else if (key === 'over35') hit = total >= 4
    else if (key === 'bttsYes' || key === 'btts') hit = gf > 0 && ga > 0
    else if (key === 'under15') hit = total < 2
    else if (key === 'under25') hit = total < 3
    else if (key === 'under35') hit = total < 4
    else if (key === 'bttsNo') hit = !(gf > 0 && ga > 0)
    else continue
    yes += hit ? 1 : 0
    count += 1
  }
  return count ? yes / count * 100 : null
}

function formTripletV155(data = {}) {
  const homeForm = formStrength(data?.recent?.home || [])
  const awayForm = formStrength(data?.recent?.away || [])
  const hGF = Number(data?.teamStats?.home?.goalsForAvg) || avg(data?.recent?.home, 'gf', 1.35)
  const hGA = Number(data?.teamStats?.home?.goalsAgainstAvg) || avg(data?.recent?.home, 'ga', 1.20)
  const aGF = Number(data?.teamStats?.away?.goalsForAvg) || avg(data?.recent?.away, 'gf', 1.15)
  const aGA = Number(data?.teamStats?.away?.goalsAgainstAvg) || avg(data?.recent?.away, 'ga', 1.35)
  const strength = (homeForm - awayForm) * .55 + ((hGF - hGA) - (aGF - aGA)) * 14 + 7
  const draw = clampNum(29 - Math.abs(strength) * .10, 18, 31, 26)
  const remaining = 100 - draw
  const homeShare = 1 / (1 + Math.exp(-strength / 16))
  return normalizeTriplet({ home: remaining * homeShare, draw, away: remaining * (1 - homeShare) })
}

function poissonProbabilityForKeyV155(forecast = {}, key = '') {
  const xg = forecast?.xg || {}
  if (!(Number(xg.home) >= 0) || !(Number(xg.away) >= 0)) return null
  const p = poissonForecast(Number(xg.home), Number(xg.away))
  if (['home','draw','away'].includes(key)) return Number(p?.oneXTwo?.[key] || 0)
  if (key === 'over15') return Number(p.over15)
  if (key === 'under15') return 100 - Number(p.over15)
  if (key === 'over25') return Number(p.over25)
  if (key === 'under25') return 100 - Number(p.over25)
  if (key === 'over35') return Number(p.over35)
  if (key === 'under35') return 100 - Number(p.over35)
  if (key === 'bttsYes' || key === 'btts') return Number(p.btts)
  if (key === 'bttsNo') return 100 - Number(p.btts)
  return null
}

function bookmakerNoVigProbabilityV155(data = {}, key = '') {
  const books = Array.isArray(data?.odds?.books) ? data.odds.books : []
  const values = []
  for (const book of books) {
    if (['home','draw','away'].includes(key)) {
      const h = Number(book?.home), d = Number(book?.draw), a = Number(book?.away)
      if (h > 1 && d > 1 && a > 1) {
        const ih = 1 / h, id = 1 / d, ia = 1 / a, sum = ih + id + ia
        values.push((key === 'home' ? ih : key === 'draw' ? id : ia) / sum * 100)
      }
      continue
    }
    const pair = key === 'over15' || key === 'under15' ? ['over15','under15']
      : key === 'over25' || key === 'under25' ? ['over25','under25']
      : key === 'over35' || key === 'under35' ? ['over35','under35']
      : key === 'bttsYes' || key === 'bttsNo' || key === 'btts' ? ['bttsYes','bttsNo'] : null
    if (!pair) continue
    const yesOdd = Number(book?.[pair[0]]), noOdd = Number(book?.[pair[1]])
    if (yesOdd > 1 && noOdd > 1) {
      const iy = 1 / yesOdd, ino = 1 / noOdd, denom = iy + ino
      const yesProb = iy / denom * 100
      const wantsYes = [pair[0], 'btts'].includes(key)
      values.push(wantsYes ? yesProb : 100 - yesProb)
    }
  }
  return values.length ? values.reduce((a,b) => a+b, 0) / values.length : null
}

function webProbabilityForKeyV155(consensus = null, key = '') {
  if (['home','draw','away'].includes(key)) {
    const triplet = consensus?.consensus?.available ? normalizeTriplet(consensus?.consensus?.percent) : null
    return triplet ? Number(triplet[key]) : null
  }
  if (key === 'over25' && consensus?.goals?.available) return Number(consensus.goals.over25 || 0) || null
  if (key === 'under25' && consensus?.goals?.available) return Number(consensus.goals.under25 || (100 - Number(consensus.goals.over25 || 0)))
  if ((key === 'bttsYes' || key === 'btts') && consensus?.goals?.bttsAvailable) return Number(consensus.goals.bttsYes || 0) || null
  if (key === 'bttsNo' && consensus?.goals?.bttsAvailable) return Number(consensus.goals.bttsNo || (100 - Number(consensus.goals.bttsYes || 0)))
  return null
}

function buildEnsembleValidationV155({ data = {}, forecast = null, consensus = null } = {}) {
  const candidate = forecast?.value?.top3?.[0] || forecast?.value?.top || null
  if (!candidate?.key) return null
  const key = candidate.key
  const formOne = formTripletV155(data)
  const sourceRows = []
  const add = (id, label, probability, weight) => {
    const value = Number(probability)
    if (!Number.isFinite(value) || value <= 0 || value >= 100) return
    sourceRows.push({ id, label, probability: round1(value), weight })
  }
  add('poisson', 'Poisson / xG', poissonProbabilityForKeyV155(forecast, key), 1.25)
  if (['home','draw','away'].includes(key)) add('form', 'Forma + home/away', formOne?.[key], 1.00)
  else add('recent', 'Ostatnie realne mecze', recentBinaryProbabilityV155(data, key), 1.00)
  const apiTriplet = normalizeTriplet(data?.prediction?.percent)
  if (['home','draw','away'].includes(key) && apiTriplet) add('api', 'API Prediction', apiTriplet[key], .80)
  add('market', 'Rynek no-vig', bookmakerNoVigProbabilityV155(data, key), .85)
  add('web', 'Web consensus', webProbabilityForKeyV155(consensus, key), .60)

  const totalWeight = sourceRows.reduce((sum, row) => sum + row.weight, 0)
  const ensembleProbability = totalWeight ? sourceRows.reduce((sum, row) => sum + row.probability * row.weight, 0) / totalWeight : Number(candidate.probability || 0)
  const probs = sourceRows.map(row => row.probability)
  const avgP = probs.length ? probs.reduce((a,b) => a+b,0) / probs.length : 0
  const std = probs.length > 1 ? Math.sqrt(probs.reduce((sum, p) => sum + (p - avgP) ** 2, 0) / probs.length) : 0
  const spread = probs.length > 1 ? Math.max(...probs) - Math.min(...probs) : 0
  let status = 'LOW', penalty = 0
  if (sourceRows.length >= 3 && (spread >= 18 || std >= 7)) { status = 'HIGH'; penalty = 3.5 }
  else if (sourceRows.length >= 3 && (spread >= 11 || std >= 4.5)) { status = 'MEDIUM'; penalty = 1.6 }
  return {
    version: 'BETAI_ENSEMBLE_V155',
    key,
    label: forecastLabel(key),
    sources: sourceRows,
    independentSources: sourceRows.length,
    probability: round1(ensembleProbability),
    modelProbability: round1(Number(candidate.probability || 0)),
    deltaVsModelPp: round1(ensembleProbability - Number(candidate.probability || 0)),
    disagreement: { status, spreadPp: round1(spread), stdPp: round1(std), uncertaintyPenaltyPp: penalty }
  }
}

function buildProfessionalPredictionLabV152({ match = {}, forecast = null, reliability = null, performance = null, oddsHistory = null, ensembleValidation = null, modelLab = null } = {}) {
  if (!forecast) return null
  const candidate = forecast?.value?.top3?.[0] || forecast?.value?.top || null
  if (!candidate) return {
    version: 'BETAI_PRO_LAB_V166', decisionCard: { decision: 'NO_BET', reason: 'Brak pełnego rynku kursowego do policzenia przewagi.', key: '', label: 'BRAK RYNKU' },
    uncertainty: { pp: 10, conservativeProbability: 0 }, leagueTrust: { score: 50, label: 'PENDING', samples: 0 }, drift: { status: 'PENDING', score: 50 }, walkForward: { samples: 0 }, paperPortfolio: performance?.paperPortfolio || null
  }
  const league = safeTextV158(match?.league || '', '')
  const rawProbability = rawProbabilityForKeyV152(forecast, candidate.key)
  const calibratedProbability = Number(candidate?.probability || 0)
  const relScore = Number(reliability?.score || 0)
  const quality = Number(forecast?.dataQuality || 0)
  const modelAgreement = Number(reliability?.components?.modelAgreement || forecast?.value?.modelAgreement || 60)
  const sourceCount = Number(ensembleValidation?.independentSources || forecast?.consensus?.sourceCount || 0)
  const webSourceCount = Number(forecast?.consensus?.sourceCount || 0)
  const consensusAgreement = Number(forecast?.consensus?.agreement || 0)
  const calibrationSamples = Number(candidate?.calibration?.samples || reliability?.calibration?.samples || 0)
  const trust = findLeagueTrustV150(performance, league, candidate.key)
  const drift = findDriftV149(performance, candidate.key)
  const walkForward = findWalkForwardV147(performance, candidate.key)
  const autoGate = modelLab?.autoGate || { status: 'PENDING', reason: '' }
  const statConfidence = modelLab?.statisticalConfidence || { level: 'PENDING', samples: 0 }
  const correlationRisk = modelLab?.correlationRisk || { level: 'LOW', score: 0 }

  let uncertainty = 2.4
  uncertainty += Math.max(0, 92 - quality) * 0.055
  uncertainty += Math.max(0, 82 - relScore) * 0.045
  uncertainty += Math.max(0, 82 - modelAgreement) * 0.035
  if (sourceCount < 3) uncertainty += 1.0
  if (webSourceCount >= 3 && consensusAgreement < 65) uncertainty += Math.min(1.5, (65 - consensusAgreement) * 0.04)
  if (calibrationSamples < 30) uncertainty += 2.4
  else if (calibrationSamples < 100) uncertainty += 0.8
  if (String(drift?.status || '').toUpperCase() === 'WATCH') uncertainty += 1.1
  if (String(drift?.status || '').toUpperCase() === 'DRIFT') uncertainty += 2.8
  if (Number(trust?.score || 0) >= 80) uncertainty -= 0.6
  if (Number(trust?.score || 0) < 60) uncertainty += 1.4
  uncertainty += Number(ensembleValidation?.disagreement?.uncertaintyPenaltyPp || 0)
  if (String(statConfidence?.level || '').toUpperCase() === 'LOW') uncertainty += 0.8
  if (String(statConfidence?.level || '').toUpperCase() === 'PENDING') uncertainty += 1.2
  if (String(autoGate?.status || '').toUpperCase() === 'WATCH') uncertainty += 0.9
  uncertainty = round1(clampNum(uncertainty, 2.5, 14, 7))

  const conservativeProbability = round1(clampNum(calibratedProbability - uncertainty, 1, 99, calibratedProbability))
  const conservativeFairOdds = fairOdd(conservativeProbability)
  const noVig = Number(candidate?.noVigImplied || 0)
  const conservativeEdge = noVig > 0 ? round1(conservativeProbability - noVig) : null
  const threshold = Number(candidate?.threshold || 5)
  const clv = findClvForCandidateV152(oddsHistory, candidate)

  let decision = 'NO_BET'
  let reason = 'Brak wystarczającej przewagi po konserwatywnej korekcie.'
  if (!(Number(candidate?.bookmakerOdds || 0) > 1) || !(noVig > 0)) {
    reason = 'Brak pełnych kursów potrzebnych do obliczenia rynku no-vig.'
  } else if (String(autoGate?.status || '').toUpperCase() === 'BLOCKED') {
    reason = `NO BET: AUTO-GATE zablokował rynek — ${autoGate?.reason || 'historyczna jakość modelu jest zbyt słaba.'}`
  } else if (String(drift?.status || '').toUpperCase() === 'DRIFT') {
    reason = 'NO BET: wykryto pogorszenie modelu (MODEL DRIFT).'
  } else if (ensembleValidation?.independentSources >= 3 && ensembleValidation?.disagreement?.status === 'HIGH') {
    reason = `NO BET: Sharp Disagreement — modele składowe rozjeżdżają się o ${ensembleValidation.disagreement.spreadPp} pp.`
  } else if (Number(trust?.score || 0) < 55 && Number(trust?.samples || 0) >= 20) {
    reason = 'NO BET: niski League & Market Trust Score.'
  } else if (relScore < 65) {
    reason = 'NO BET: zbyt niska wiarygodność analizy.'
  } else if (calibrationSamples < 30) {
    decision = 'WATCH'
    reason = `WATCH: kalibracja ma ${calibrationSamples}/30 wymaganych prób.`
  } else if (conservativeEdge != null && conservativeEdge >= threshold && Number(candidate?.expectedValuePct || 0) > 0) {
    decision = 'BET'
    reason = `BET: przewaga pozostaje dodatnia nawet po odjęciu ±${uncertainty} pp niepewności.`
  } else if (conservativeEdge != null && conservativeEdge > 0) {
    decision = 'WATCH'
    reason = 'WATCH: dodatnia przewaga istnieje, ale nie przechodzi konserwatywnego progu wejścia.'
  }
  if (decision === 'BET' && String(autoGate?.status || '').toUpperCase() === 'WATCH') {
    decision = 'WATCH'
    reason = `WATCH: AUTO-GATE wymaga obserwacji — ${autoGate?.reason || 'rynek nie ma jeszcze stabilnej historii.'}`
  }
  if (decision === 'BET' && ensembleValidation?.disagreement?.status === 'MEDIUM' && conservativeEdge < threshold + 3) {
    decision = 'WATCH'
    reason = `WATCH: modele składowe mają średnią rozbieżność (${ensembleValidation.disagreement.spreadPp} pp).`
  }

  return {
    version: 'BETAI_PRO_LAB_V166',
    walkForwardVersion: 'BETAI_WALK_FORWARD_V1', uncertaintyVersion: 'BETAI_UNCERTAINTY_V1', driftVersion: 'BETAI_DRIFT_V1', trustVersion: 'BETAI_TRUST_V1', shadowVersion: 'BETAI_SHADOW_PORTFOLIO_V1',
    uncertainty: { pp: uncertainty, rawProbability: round1(rawProbability), calibratedProbability: round1(calibratedProbability), conservativeProbability, conservativeFairOdds },
    leagueTrust: trust,
    drift,
    walkForward,
    paperPortfolio: performance?.paperPortfolio || null,
    ensembleValidation: ensembleValidation || null,
    modelLab: modelLab || null,
    autoGate, statisticalConfidence: statConfidence, correlationRisk,
    clv: clv ? { openOdds: Number(clv.openOdds || 0), latestOdds: Number(clv.latestOdds || 0), clvPct: clv.clvPct, nearKickoff: Boolean(clv.nearKickoff), snapshots: Number(clv.snapshots || 0) } : null,
    decisionCard: {
      decision, reason, key: candidate.key, label: forecastLabel(candidate.key), marketGroup: candidate.marketGroup,
      rawProbability: round1(rawProbability), calibratedProbability: round1(calibratedProbability), uncertaintyPp: uncertainty, conservativeProbability,
      fairOdds: conservativeFairOdds, modelFairOdds: Number(candidate.fairOdds || 0), bookmakerOdds: Number(candidate.bookmakerOdds || 0), bookmaker: candidate.bookmaker || '',
      noVigProbability: noVig ? round1(noVig) : null, conservativeEdgePp: conservativeEdge, rawEdgePp: Number(candidate.edgePp || 0), expectedValuePct: Number(candidate.expectedValuePct || 0),
      reliability: relScore, dataQuality: quality, leagueTrust: Number(trust?.score || 0), trustLabel: trust?.label || 'PENDING', sampleSize: calibrationSamples,
      driftStatus: drift?.status || 'PENDING', walkForwardSamples: Number(walkForward?.samples || 0), walkForwardBrier: Number(walkForward?.walkForwardBrier || 0),
      ensembleProbability: Number(ensembleValidation?.probability || 0), ensembleSources: Number(ensembleValidation?.independentSources || 0), disagreementStatus: ensembleValidation?.disagreement?.status || 'PENDING', disagreementSpreadPp: Number(ensembleValidation?.disagreement?.spreadPp || 0),
      clvPct: clv?.clvPct ?? null, stakeUnits: 1,
      activeModel: forecast?.activeModel || 'champion', autoGateStatus: autoGate?.status || 'PENDING', statisticalConfidence: statConfidence?.level || 'PENDING', correlationRisk: correlationRisk?.level || 'LOW', modelMarketSeparated: true
    }
  }
}

export default function MatchSimulatorPreparationView({ lang = 'pl', match, onBack, onStart }) {
  const copy = COPY[lang] || COPY.pl
  const phases = lang === 'en' ? LOAD_PHASES_EN : LOAD_PHASES_PL
  const [progress, setProgress] = useState(4)
  const [data, setData] = useState(null)
  const [consensus, setConsensus] = useState(null)
  const [consensusLoading, setConsensusLoading] = useState(false)
  const [consensusError, setConsensusError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [forecastSaveState, setForecastSaveState] = useState('')
  const [auditState, setAuditState] = useState({ captured: false, hash: '' })
  const [oddsHistory, setOddsHistory] = useState(null)
  const [modelPerformance, setModelPerformance] = useState(null)
  const [modelPerformanceLoading, setModelPerformanceLoading] = useState(false)
  const [rateShieldState, setRateShieldState] = useState({ active: false, attempt: 0, retryMs: 0, mode: '' })
  const mountedRef = useRef(true)
  const forecastSavedRef = useRef('')

  const loadConsensus = async (payload) => {
    if (isBetAiLabTestV152(match)) {
      setConsensus(buildBetAiLabConsensusV152())
      setConsensusLoading(false)
      setConsensusError('')
      return
    }
    const fixture = payload?.fixture || {}
    const params = new URLSearchParams({
      home: fixture?.home?.name || match?.home || '',
      away: fixture?.away?.name || match?.away || '',
      league: safeTextV158(fixture?.league || match?.league || '', ''),
      country: safeTextV158(fixture?.country || match?.country || '', ''),
      date: fixture?.date || match?.rawDate || match?.date || ''
    })
    setConsensusLoading(true)
    setConsensusError('')
    try {
      const response = await fetch(`/.netlify/functions/get-match-consensus?${params.toString()}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Błąd Web Intelligence')
      if (!mountedRef.current) return
      setConsensus(result)
      if (result?.error) setConsensusError(result.error)
    } catch (err) {
      if (!mountedRef.current) return
      setConsensus(null)
      setConsensusError(err?.message || 'Błąd Web Intelligence')
    } finally {
      if (mountedRef.current) setConsensusLoading(false)
    }
  }

  const load = async () => {
    if (isBetAiLabTestV152(match)) {
      setLoading(true)
      setError('')
      setData(null)
      setProgress(18)
      setRateShieldState({ active: true, attempt: 0, retryMs: 0, mode: 'cache' })
      await pause(180)
      if (!mountedRef.current) return
      const testData = buildBetAiLabTestDataV152(match)
      setData(testData)
      setConsensus(buildBetAiLabConsensusV152())
      setConsensusError('')
      setConsensusLoading(false)
      setProgress(100)
      setLoading(false)
      return
    }
    const id = match?.apiFixtureId || match?.id
    if (!id) {
      setError('Brak fixture ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setData(null)
    setConsensus(null)
    setConsensusError('')
    setOddsHistory(null)
    setRateShieldState({ active: false, attempt: 0, retryMs: 0, mode: '' })
    setProgress(4)
    try {
      let payload = null
      const maxAttempts = 5
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(`/.netlify/functions/get-match-simulator-data?fixture=${encodeURIComponent(id)}`, { cache: 'no-store' })
        payload = await response.json().catch(() => ({}))
        if (response.ok && payload?.ok) break
        if (isRateLimitError(response, payload) && attempt < maxAttempts - 1) {
          const retryMs = Math.max(1200, Math.min(6500, Number(payload?.retryAfterMs || (1400 * (attempt + 1)))))
          if (!mountedRef.current) return
          setRateShieldState({ active: true, attempt: attempt + 1, retryMs, mode: 'retry' })
          setProgress(prev => Math.max(12, Math.min(88, prev)))
          await pause(retryMs)
          if (!mountedRef.current) return
          continue
        }
        throw new Error(friendlyPreparationError(payload?.error || payload?.message))
      }
      if (!payload?.ok) throw new Error(friendlyPreparationError(payload?.error))
      if (!mountedRef.current) return
      setData(payload)
      setProgress(100)
      const shield = payload?.rateLimitShield || {}
      setRateShieldState({
        active: Boolean(shield.cachedResponses || shield.staleFallbacks || shield.rateLimited || payload?.snapshot?.reused),
        attempt: 0,
        retryMs: 0,
        mode: shield.staleFallbacks ? 'stale' : payload?.snapshot?.reused || shield.cachedResponses ? 'cache' : 'live'
      })
      loadConsensus(payload)
    } catch (err) {
      if (!mountedRef.current) return
      setError(friendlyPreparationError(err?.message || 'Błąd danych symulacji'))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [match?.apiFixtureId, match?.id])

  useEffect(() => {
    if (!loading) return undefined
    const timer = window.setInterval(() => {
      setProgress(prev => Math.min(92, prev + (prev < 35 ? 5 : prev < 70 ? 3 : 1)))
    }, 170)
    return () => window.clearInterval(timer)
  }, [loading])

  // WERSJA 137: globalny backtest jest liczony wyłącznie z prognoz zapisanych
  // przed kickoffem i później rozliczonych prawdziwym wynikiem z API-Football.
  useEffect(() => {
    let cancelled = false
    if (isBetAiLabTestV152(match)) {
      setModelPerformance(buildBetAiLabTestPerformanceV152())
      setModelPerformanceLoading(false)
      return () => { cancelled = true }
    }
    setModelPerformanceLoading(true)
    fetch('/.netlify/functions/get-match-prediction-performance?limit=5000', { cache: 'no-store' })
      .then(response => response.json().catch(() => ({})).then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (cancelled || !mountedRef.current) return
        if (response.ok && payload?.ok && payload?.available) setModelPerformance(payload)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled && mountedRef.current) setModelPerformanceLoading(false) })
    return () => { cancelled = true }
  }, [match?.id, match?.apiFixtureId])

  const checks = useMemo(() => data ? buildChecks(match, data, copy) : [], [match, data, copy])
  const completeness = useMemo(() => {
    if (Number.isFinite(Number(data?.simulationQuality?.score))) return Math.round(Number(data.simulationQuality.score))
    if (!checks.length) return 0
    const required = checks.filter(item => item.required)
    return Math.round(required.filter(item => item.ready).length * 100 / Math.max(1, required.length))
  }, [checks, data])
  const eligibility = useMemo(() => data ? buildEligibility(match, data, checks) : { eligible: false, reasons: [] }, [match, data, checks])
  const forecast = useMemo(() => data && eligibility.eligible ? buildForecast(match, data, consensus, checks, modelPerformance) : null, [match, data, consensus, checks, eligibility.eligible, modelPerformance])
  const reliability = useMemo(() => forecast ? buildReliabilityEngine({ match, data, forecast, consensus, performance: modelPerformance }) : null, [match, data, forecast, consensus, modelPerformance])
  const modelLab = useMemo(() => forecast ? buildModelLabV180({ match, data, forecast, consensus, performance: modelPerformance, oddsHistory, challenger: forecast?.modelVariants?.challenger || null }) : null, [match, data, forecast, consensus, modelPerformance, oddsHistory])
  const ensembleValidation = modelLab?.pureEnsemble || null
  const professionalLab = useMemo(() => forecast ? buildProfessionalPredictionLabV152({ match, forecast, reliability, performance: modelPerformance, oddsHistory, ensembleValidation, modelLab }) : null, [match, forecast, reliability, modelPerformance, oddsHistory, ensembleValidation, modelLab])
  const forecastWithReliability = useMemo(() => forecast ? { ...forecast, version: 'BETAI_FORECAST_V180', validationVersion: 'BETAI_PREDICTION_ENGINE_3_V180', reliability: reliability || null, ensembleValidation: ensembleValidation || null, modelLab: modelLab || null, marketValidation: modelLab?.marketValidation || null, professionalLab: professionalLab || null } : null, [forecast, reliability, ensembleValidation, modelLab, professionalLab])
  const preparedData = useMemo(() => data ? { ...data, externalConsensus: consensus || null, predictionEngine: forecastWithReliability || null } : null, [data, consensus, forecastWithReliability])
  const phaseIndex = Math.min(phases.length - 1, Math.floor(progress / (100 / phases.length)))

  useEffect(() => {
    if (isBetAiLabTestV152(match)) {
      setForecastSaveState('test')
      setAuditState({ captured: true, hash: 'TEST-OFFLINE-V166' })
      return
    }
    if (!forecastWithReliability || !eligibility.eligible || consensusLoading || modelPerformanceLoading) return
    const fixtureId = String(match?.apiFixtureId || match?.id || data?.fixture?.id || '')
    if (!fixtureId) return
    const oddsSignature = (forecastWithReliability.value?.top3 || []).map(item => `${item.key}:${item.bookmaker}:${item.bookmakerOdds}`).join(',')
    const signature = `${fixtureId}|${forecastWithReliability.version}|${forecastWithReliability.dataQuality}|${forecastWithReliability.consensus.sourceCount}|${forecastWithReliability.xg.home}|${forecastWithReliability.xg.away}|${forecastWithReliability.value?.state || ''}|${forecastWithReliability.value?.top?.key || ''}|${forecastWithReliability.reliability?.score || 0}|${oddsSignature}`
    if (forecastSavedRef.current === signature) return
    forecastSavedRef.current = signature
    setForecastSaveState('saving')
    fetch('/.netlify/functions/save-match-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixtureId,
        fixtureDate: data?.fixture?.date || match?.rawDate || match?.date || null,
        homeTeam: safeTextV158(data?.fixture?.home?.name || match?.home || '', ''),
        awayTeam: safeTextV158(data?.fixture?.away?.name || match?.away || '', ''),
        league: safeTextV158(data?.fixture?.league || match?.league || '', ''),
        country: safeTextV158(data?.fixture?.country || match?.country || '', ''),
        forecast: forecastWithReliability,
        consensus: consensus || null
      })
    }).then(response => response.json().catch(() => ({})).then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!mountedRef.current) return
        setForecastSaveState(response.ok && payload?.ok ? 'saved' : 'local')
        if (payload?.oddsHistory) setOddsHistory(payload.oddsHistory)
        if (payload?.audit?.captured) setAuditState({ captured: true, hash: String(payload.audit.auditHash || '') })
      })
      .catch(() => { if (mountedRef.current) setForecastSaveState('local') })
  }, [forecastWithReliability, eligibility.eligible, consensusLoading, modelPerformanceLoading, match, data, consensus])

  return (
    <section className="sim-prep-v116">
      <div className="sim-prep-head-v116">
        <button type="button" className="sim-prep-back-v116" onClick={onBack}>{copy.back}</button>
        <span>{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>

      <div className="sim-prep-match-v116">
        <div className="sim-prep-team-v116 home">
          {match?.homeLogo ? <img src={match.homeLogo} alt="" /> : null}
          <strong>{safeTextV158(match?.home, '—')}</strong>
        </div>
        <div className="sim-prep-vs-v116">
          <small>{safeTextV158(match?.league, 'Mecz')}</small>
          <b>VS</b>
          <span>{match?.time || '—'}</span>
        </div>
        <div className="sim-prep-team-v116 away">
          <strong>{safeTextV158(match?.away, '—')}</strong>
          {match?.awayLogo ? <img src={match.awayLogo} alt="" /> : null}
        </div>
      </div>

      <div className="sim-prep-loader-v116">
        <div className="sim-prep-loader-top-v116">
          <div><small>{loading ? copy.loading : error ? 'BŁĄD' : copy.ready}</small><strong>{error || phases[phaseIndex]}</strong></div>
          <b>{loading ? progress : data ? 100 : progress}%</b>
        </div>
        <div className="sim-prep-track-v116"><i style={{ width: `${loading ? progress : data ? 100 : progress}%` }} /></div>
        {rateShieldState.active ? <div className={`sim-prep-rate-shield-v138 ${rateShieldState.mode || ''}`}>
          <b>RATE LIMIT SHIELD</b>
          <span>{rateShieldState.mode === 'retry' ? `API 429 • automatyczne ponowienie ${rateShieldState.attempt}/4 za ${(rateShieldState.retryMs / 1000).toFixed(1)}s` : rateShieldState.mode === 'stale' ? 'API zajęte • używam ostatnich poprawnych danych z cache' : rateShieldState.mode === 'cache' ? 'Supabase cache / snapshot • oszczędzam requesty API' : 'Globalny throttle API aktywny'}</span>
        </div> : null}
        <div className="sim-prep-phases-v116">
          {phases.map((phase, index) => <span key={phase} className={index <= phaseIndex || data ? 'active' : ''}><i>{index < phaseIndex || data ? '✓' : index === phaseIndex && loading ? '●' : '○'}</i>{phase}</span>)}
        </div>
      </div>

      {error ? <div className="sim-prep-error-v116"><span>⚠ {error}</span><button type="button" onClick={load}>{copy.retry}</button></div> : null}

      {data ? <>
        <div className="sim-prep-score-v116">
          <div><small>{copy.completeness}</small><strong>{completeness}%</strong><span>{copy.source}{data?.snapshot?.enabled ? ` • ${data.snapshot.reused ? 'Snapshot Supabase' : 'Zapis Supabase'}` : ''}</span>{data?.snapshot?.note ? <em className="sim-prep-snapshot-note-v131">{data.snapshot.note}</em> : null}</div>
          <div className="sim-prep-ring-v116" style={{ '--pct': completeness }}><b>{completeness}</b><small>%</small></div>
        </div>

        <div className="sim-prep-checks-v116">
          {checks.map(item => <article key={item.key} className={item.ready ? (item.predicted ? 'predicted' : 'ready') : !item.required ? 'optional' : item.pending ? 'pending' : 'missing'}>
            <i>{item.ready ? (item.predicted ? 'P' : '✓') : !item.required ? 'i' : item.pending ? '…' : '!'}</i>
            <div><strong>{item.label}</strong><span>{item.detail}</span></div>
          </article>)}
        </div>

        <div className="sim-prep-webintel-v128">
          <div className="sim-prep-webintel-head-v128">
            <div><small>BET+AI MULTI-SOURCE</small><strong>{copy.webIntel}</strong></div>
            {consensusLoading ? <span className="loading">● LIVE RESEARCH</span> : consensus?.enabled ? <span>✓ WEB SEARCH</span> : <span className="off">API OFF</span>}
          </div>
          {consensusLoading ? <p>{copy.webIntelLoading}</p> : consensus?.enabled ? <>
            {consensus?.consensus?.available ? <div className="sim-prep-consensus-v128">
              <div><small>{copy.consensus}</small><b>1&nbsp; {consensus.consensus.percent.home}%</b></div>
              <div><small>REMIS</small><b>X&nbsp; {consensus.consensus.percent.draw}%</b></div>
              <div><small>GOŚCIE</small><b>2&nbsp; {consensus.consensus.percent.away}%</b></div>
              <em>{consensus.consensus.sourceCount} {copy.sourcesFound} • zgodność {consensus.consensus.agreement || 0}%</em>
            </div> : <p>{consensusError || consensus?.consensus?.summary || 'Nie znaleziono wystarczającej liczby niezależnych prognoz dla tego meczu.'}</p>}
            {consensus?.goals?.available ? <div className="sim-prep-goals-consensus-v129">
              <div><small>GOLE 2.5</small><b>OVER {consensus.goals.over25}%</b><span>UNDER {consensus.goals.under25}%</span></div>
              {consensus.goals.bttsAvailable ? <div><small>BTTS</small><b>TAK {consensus.goals.bttsYes}%</b><span>NIE {consensus.goals.bttsNo}%</span></div> : null}
              <em>{consensus.goals.sourceCount || 0} źródeł • pewność {consensus.goals.confidence || 0}%</em>
            </div> : null}
            <div className="sim-prep-source-grid-v128">
              {(consensus?.sourceRegistry || []).map(source => {
                const found = (consensus?.sources || []).find(item => String(item.name || '').toLowerCase().includes(String(source.name || '').toLowerCase()) || String(item.url || '').includes(new URL(source.url).hostname))
                return <a key={source.key} href={source.url} target="_blank" rel="noreferrer" className={found?.status === 'found' ? 'found' : found?.status === 'blocked' ? 'blocked' : ''} title={found?.note || source.role}><i>{found?.status === 'found' ? '✓' : found?.status === 'blocked' ? '!' : '○'}</i><span>{source.name}</span></a>
              })}
            </div>
            {consensus?.consensus?.summary ? <p className="summary">{consensus.consensus.summary}</p> : null}
          </> : <>
            <p>{consensusError || copy.webIntelOff}</p>
            <div className="sim-prep-source-grid-v128">{(consensus?.sourceRegistry || []).map(source => <a key={source.key} href={source.url} target="_blank" rel="noreferrer"><i>○</i><span>{source.name}</span></a>)}</div>
          </>}
        </div>

        {forecast ? <section className="sim-prep-forecast-v136">
          <div className="sim-prep-forecast-head-v136">
            <div><small>BET+AI PREDICTION ENGINE V2</small><strong>Prognoza przedmeczowa + Value Engine</strong></div>
            <div className="sim-prep-forecast-badges-v136"><span>DATA {forecast.dataQuality}/100</span><span>MODEL {String(forecast.activeModel || 'champion').toUpperCase()}</span><span>{forecast.consensus.sourceCount ? `CONSENSUS ${forecast.consensus.sourceCount}` : 'MODEL DATA'}</span><span>ODDS {forecast.value?.bookmakerCount || 0}</span>{forecastSaveState === 'saved' ? <span className="saved">SUPABASE ✓</span> : null}</div>
          </div>

          <div className="sim-prep-forecast-main-v136">
            <div className="sim-prep-xg-v136">
              <small>EXPECTED GOALS</small>
              <div><b>{forecast.xg.home.toFixed(2)}</b><span>xG</span><b>{forecast.xg.away.toFixed(2)}</b></div>
              <em>{match?.home} &nbsp;—&nbsp; {match?.away}</em>
            </div>
            <div className="sim-prep-1x2-v136">
              <article><small>1 • GOSPODARZE</small><b>{forecast.oneXTwo.home}%</b><span>fair {forecast.fairOdds.home.toFixed(2)}</span></article>
              <article><small>X • REMIS</small><b>{forecast.oneXTwo.draw}%</b><span>fair {forecast.fairOdds.draw.toFixed(2)}</span></article>
              <article><small>2 • GOŚCIE</small><b>{forecast.oneXTwo.away}%</b><span>fair {forecast.fairOdds.away.toFixed(2)}</span></article>
            </div>
          </div>

          <div className="sim-prep-goalmarkets-v136">
            <article><small>OVER 1.5</small><b>{forecast.goals.over15}%</b><span>fair {forecast.fairOdds.over15.toFixed(2)}</span></article>
            <article><small>OVER 2.5</small><b>{forecast.goals.over25}%</b><span>fair {forecast.fairOdds.over25.toFixed(2)}</span></article>
            <article><small>OVER 3.5</small><b>{forecast.goals.over35}%</b><span>fair {forecast.fairOdds.over35.toFixed(2)}</span></article>
            <article><small>BTTS • TAK</small><b>{forecast.goals.btts}%</b><span>fair {forecast.fairOdds.btts.toFixed(2)}</span></article>
          </div>

          <div className="sim-prep-calibration2-v146">
            <div className="sim-prep-calibration2-head-v146">
              <div><small>CALIBRATION ENGINE 2.0</small><strong>RAW → skalibrowane prawdopodobieństwo</strong></div>
              <span>{forecast.calibration?.over25?.applied || forecast.calibration?.btts?.applied || forecast.calibration?.oneXTwo?.applied ? 'HISTORIA AKTYWNA' : 'ZBIERANIE PRÓB'}</span>
            </div>
            <div className="sim-prep-calibration2-grid-v146">
              {[
                ['1X2 TOP', forecast.calibration?.oneXTwo?.top?.raw, forecast.calibration?.oneXTwo?.top?.calibrated, forecast.calibration?.oneXTwo?.top?.calibration],
                ['OVER 1.5', forecast.raw?.goals?.over15, forecast.goals.over15, forecast.calibration?.over15?.calibration],
                ['OVER 2.5', forecast.raw?.goals?.over25, forecast.goals.over25, forecast.calibration?.over25?.calibration],
                ['OVER 3.5', forecast.raw?.goals?.over35, forecast.goals.over35, forecast.calibration?.over35?.calibration],
                ['BTTS', forecast.raw?.goals?.btts, forecast.goals.btts, forecast.calibration?.btts?.calibration]
              ].map(([label, raw, calibrated, cal]) => <article key={label}>
                <small>{label}</small>
                <div><span>{raw == null ? '—' : `${Number(raw).toFixed(1)}%`}</span><i>→</i><b>{calibrated == null ? '—' : `${Number(calibrated).toFixed(1)}%`}</b></div>
                <em>{cal?.samples || 0} prób • {cal?.source === 'league' ? 'liga' : 'global'} • {cal?.status || 'PENDING'}</em>
              </article>)}
            </div>
          </div>

          <div className="sim-prep-sourceweights-v146">
            <div><small>DYNAMIC SOURCE WEIGHTING</small><strong>Wagi źródeł dla tego meczu</strong></div>
            <article><span>MODEL STATYSTYCZNY</span><b>{forecast.sourceWeights?.stats || 0}%</b><i><em style={{ width: `${forecast.sourceWeights?.stats || 0}%` }} /></i></article>
            <article><span>API PREDICTION</span><b>{forecast.sourceWeights?.api || 0}%</b><i><em style={{ width: `${forecast.sourceWeights?.api || 0}%` }} /></i></article>
            <article><span>WEB / EXPERT CONSENSUS</span><b>{forecast.sourceWeights?.web || 0}%</b><i><em style={{ width: `${forecast.sourceWeights?.web || 0}%` }} /></i></article>
            <p>Wagi zmieniają się zależnie od dostępności danych, zgodności źródeł i historycznej jakości modelu. Kurs bukmachera nie jest używany do sztucznego podbijania prognozy — służy do niezależnej oceny VALUE.</p>
          </div>

          <div className="sim-prep-forecast-bottom-v136">
            <div className="sim-prep-scorelines-v136"><small>NAJBARDZIEJ PRAWDOPODOBNE WYNIKI</small><div>{forecast.topScores.map(item => <span key={item.score}><b>{item.score}</b><em>{item.probability}%</em></span>)}</div></div>
            <div className={`sim-prep-value-v136 ${String(forecast.value.state || '').toLowerCase()}`}>
              <small>BET+AI VALUE ENGINE V2 • NO-VIG</small>
              {forecast.value.state === 'STRONG_VALUE' && forecast.value.top ? <><strong>STRONG VALUE</strong><b>{forecastLabel(forecast.value.top.key)} @ {forecast.value.top.bookmakerOdds.toFixed(2)}</b><span>Model {forecast.value.top.probability}% • fair {forecast.value.top.fairOdds.toFixed(2)} • edge +{forecast.value.top.edgePp} pp • EV +{forecast.value.top.expectedValuePct}%</span></> : forecast.value.state === 'VALUE' && forecast.value.top ? <><strong>VALUE DETECTED</strong><b>{forecastLabel(forecast.value.top.key)} @ {forecast.value.top.bookmakerOdds.toFixed(2)}</b><span>Model {forecast.value.top.probability}% • fair {forecast.value.top.fairOdds.toFixed(2)} • edge +{forecast.value.top.edgePp} pp • EV +{forecast.value.top.expectedValuePct}%</span></> : forecast.value.state === 'CALIBRATION_PENDING' ? <><strong>NO BET — KALIBRACJA</strong><b>Za mała próbka historyczna</b><span>Bet+AI pokaże rekomendację dopiero po min. {forecast.value.calibrationRequiredSamples || 30} rozliczonych próbach danego rynku.</span></> : forecast.value.state === 'SMALL_EDGE' && forecast.value.top ? <><strong>SMALL EDGE</strong><b>{forecastLabel(forecast.value.top.key)} @ {forecast.value.top.bookmakerOdds.toFixed(2)}</b><span>Przewaga +{forecast.value.top.edgePp} pp jest poniżej wymaganego progu {forecast.value.top.threshold} pp.</span></> : forecast.value.state === 'NO_BET' && forecast.value.top ? <><strong>NO BET</strong><b>{forecast.value.top.reason || 'Brak wystarczającej przewagi'}</b><span>Model {forecast.value.top.probability}% • rynek no-vig {forecast.value.top.noVigImplied ?? '—'}% • próg {forecast.value.top.threshold ?? '—'} pp</span></> : <><strong>VALUE NIEOCENIONE</strong><b>Brak pełnych realnych kursów</b><span>Do Value V2 potrzebna jest para/komplet kursów z tego samego bukmachera, aby usunąć marżę.</span></>}
            </div>
          </div>

          {oddsHistory?.markets?.length ? <div className="sim-prep-clv-v146">
            <div className="sim-prep-clv-head-v146">
              <div><small>ODDS HISTORY • CLOSING LINE VALUE</small><strong>Ruch rynku zapisany w Supabase</strong></div>
              <span>0 DODATKOWYCH REQUESTÓW API</span>
            </div>
            <div className="sim-prep-clv-grid-v146">
              {oddsHistory.markets.slice(0, 6).map((row, index) => <article key={`${row.marketKey}-${row.bookmaker}-${index}`}>
                <header><b>{forecastLabel(row.marketKey)}</b><small>{row.bookmaker}</small></header>
                <div><span>OPEN <b>{Number(row.openOdds || 0).toFixed(2)}</b></span><i>→</i><span>LAST <b>{Number(row.latestOdds || 0).toFixed(2)}</b></span></div>
                <footer>{row.clvPct == null ? <em>CLV po kursie blisko kickoffu • {row.snapshots} snapshotów</em> : <strong className={Number(row.clvPct) >= 0 ? 'positive' : 'negative'}>CLV {Number(row.clvPct) > 0 ? '+' : ''}{row.clvPct}%</strong>}</footer>
              </article>)}
            </div>
          </div> : null}

          {forecast.value?.top3?.length ? <div className="sim-prep-value-engine-v138">
            <div className="sim-prep-value-engine-head-v138">
              <div><small>VALUE BET ENGINE V2</small><strong>{forecast.value.detected ? 'TOP 3 przewagi cenowe' : 'TOP 3 kandydaci • bez wymuszania zakładu'}</strong></div>
              <span>{forecast.value.marginRemoved ? 'MARŻA USUNIĘTA ✓' : 'NO-VIG NIEDOSTĘPNE'}</span>
            </div>
            <div className="sim-prep-value-cards-v138">
              {forecast.value.top3.map((item, index) => <article key={`${item.key}-${item.bookmaker}-${index}`} className={String(item.decision || '').toLowerCase()}>
                <header><small>#{index + 1} • {item.marketGroup}</small><em>{valueDecisionLabel(item.decision)}</em></header>
                <h4>{forecastLabel(item.key)}</h4>
                <div className="sim-prep-value-metrics-v138">
                  <span><small>BET+AI</small><b>{item.probability}%</b></span>
                  <span><small>FAIR ODDS</small><b>{Number(item.fairOdds || 0).toFixed(2)}</b></span>
                  <span><small>KURS</small><b>{Number(item.bookmakerOdds || 0).toFixed(2)}</b></span>
                  <span><small>IMPLIED RAW</small><b>{item.rawImplied}%</b></span>
                  <span><small>RYNEK NO-VIG</small><b>{item.noVigImplied == null ? '—' : `${item.noVigImplied}%`}</b></span>
                  <span><small>EDGE</small><b className={item.edgePp > 0 ? 'positive' : 'negative'}>{item.edgePp > 0 ? '+' : ''}{item.edgePp} pp</b></span>
                  <span><small>EV</small><b className={item.expectedValuePct > 0 ? 'positive' : 'negative'}>{item.expectedValuePct > 0 ? '+' : ''}{item.expectedValuePct}%</b></span>
                  <span><small>MIN. EDGE</small><b>{item.threshold} pp</b></span>
                </div>
                <footer>
                  <span>{item.bookmaker || 'Bookmaker'}{item.bookmakerMargin == null ? '' : ` • marża ${item.bookmakerMargin}%`}</span>
                  <span className={`cal-${String(item.calibration?.status || 'pending').toLowerCase()}`}>Kalibracja {item.calibration?.status || 'PENDING'} • {item.calibration?.samples || 0} prób • {item.calibration?.source === 'league' ? 'liga' : 'global'}</span>
                </footer>
                <p>{item.reason}</p>
              </article>)}
            </div>
          </div> : null}

          {forecast.explainability ? <div className="sim-prep-explain-v146">
            <div className="sim-prep-explain-head-v146"><div><small>EXPLAINABLE AI</small><strong>Dlaczego Bet+AI tak ocenia ten mecz?</strong></div><span>BEZ UKRYWANIA CZYNNIKÓW</span></div>
            <div className="sim-prep-explain-columns-v146">
              <section><h4>CO WSPIERA PROGNOZĘ</h4>{forecast.explainability.positives.map((item, index) => <p key={`p-${index}`}><i>+</i>{item}</p>)}</section>
              <section className="risk"><h4>RYZYKA / OGRANICZENIA</h4>{forecast.explainability.risks.map((item, index) => <p key={`r-${index}`}><i>!</i>{item}</p>)}</section>
            </div>
            <footer>{forecast.explainability.summary}</footer>
          </div> : null}

          <div className="sim-prep-factors-v136">{forecast.factors.slice(0, 5).map(factor => <span key={factor}>{factor}</span>)}</div>
          <p className="sim-prep-forecast-note-v136">Prawdopodobieństwa są estymacją modelu, nie gwarancją wyniku. Value V2 porównuje model z ceną rynku po usunięciu marży i blokuje rekomendację przy zbyt małej próbce kalibracyjnej.</p>
        </section> : null}

        {reliability ? <section className={`sim-prep-reliability-v139 rel-${String(reliability.label || 'pending').toLowerCase()}`}>
          <div className="sim-prep-reliability-head-v139">
            <div><small>BET+AI MODEL RELIABILITY V1</small><strong>Wiarygodność tej analizy</strong><p>{reliability.decisionSupport}</p></div>
            <div className="sim-prep-reliability-score-v139"><b>{reliability.score}</b><span>/100</span><em>{reliability.label}</em></div>
          </div>
          <div className="sim-prep-reliability-bars-v139">
            {[
              ['DATA QUALITY', reliability.components.dataQuality],
              ['MODEL AGREEMENT', reliability.components.modelAgreement],
              ['KALIBRACJA', reliability.components.calibration],
              ['CONSENSUS', reliability.components.consensus],
              ['RYNEK / KURSY', reliability.components.marketDepth]
            ].map(([label, value]) => <article key={label}><header><small>{label}</small><b>{value}%</b></header><div><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></article>)}
          </div>
          <footer><span>Backtest: <b>{reliability.calibration.samples}</b> prób • {reliability.calibration.status}</span><span>Źródła consensus: <b>{reliability.sourceCount}</b></span><span>Bukmacherzy: <b>{reliability.bookmakerCount}</b></span></footer>
        </section> : null}

        {professionalLab ? <section className={`sim-pro-lab-v152 decision-${String(professionalLab?.decisionCard?.decision || 'no_bet').toLowerCase()}`}>
          <header className="sim-pro-lab-head-v152">
            <div><small>BET+AI PROFESSIONAL PREDICTION LAB • V147–V166</small><strong>Finalna decyzja modelu</strong><p>Walk-Forward • Uncertainty • Drift • League Trust • Shadow Portfolio • Conservative Value</p></div>
            <div className={`sim-pro-lab-decision-v152 ${String(professionalLab?.decisionCard?.decision || '').toLowerCase()}`}><span>BET+AI</span><b>{professionalLab?.decisionCard?.decision === 'BET' ? 'BET' : professionalLab?.decisionCard?.decision === 'WATCH' ? 'WATCH' : 'NO BET'}</b></div>
          </header>
          <div className="sim-pro-lab-main-v152">
            <article className="pick"><small>RYNEK</small><strong>{professionalLab.decisionCard.label || '—'}</strong><span>{professionalLab.decisionCard.bookmakerOdds ? `@ ${Number(professionalLab.decisionCard.bookmakerOdds).toFixed(2)} • ${professionalLab.decisionCard.bookmaker}` : 'Brak pełnego rynku kursowego'}</span></article>
            <article><small>RAW MODEL</small><b>{professionalLab.decisionCard.rawProbability || 0}%</b><span>przed kalibracją</span></article>
            <article><small>CALIBRATED</small><b>{professionalLab.decisionCard.calibratedProbability || 0}%</b><span>po historii</span></article>
            <article className="uncertainty"><small>UNCERTAINTY</small><b>±{professionalLab.decisionCard.uncertaintyPp || 0} pp</b><span>margines modelu</span></article>
            <article className="conservative"><small>CONSERVATIVE P</small><b>{professionalLab.decisionCard.conservativeProbability || 0}%</b><span>używane do decyzji</span></article>
            <article><small>FAIR ODDS</small><b>{professionalLab.decisionCard.fairOdds ? Number(professionalLab.decisionCard.fairOdds).toFixed(2) : '—'}</b><span>konserwatywne</span></article>
            <article><small>MARKET NO-VIG</small><b>{professionalLab.decisionCard.noVigProbability == null ? '—' : `${professionalLab.decisionCard.noVigProbability}%`}</b><span>bez marży</span></article>
            <article className={Number(professionalLab.decisionCard.conservativeEdgePp || 0) > 0 ? 'positive' : 'negative'}><small>CONS. EDGE</small><b>{professionalLab.decisionCard.conservativeEdgePp == null ? '—' : `${professionalLab.decisionCard.conservativeEdgePp > 0 ? '+' : ''}${professionalLab.decisionCard.conservativeEdgePp} pp`}</b><span>po uncertainty</span></article>
          </div>
          <div className="sim-pro-lab-guards-v152">
            <article><header><small>RELIABILITY</small><b>{professionalLab.decisionCard.reliability || 0}/100</b></header><span>{reliability?.label || 'PENDING'}</span></article>
            <article><header><small>LEAGUE / MARKET TRUST</small><b>{professionalLab.decisionCard.leagueTrust || 0}/100</b></header><span>{professionalLab.decisionCard.trustLabel || 'PENDING'} • {professionalLab.leagueTrust?.samples || 0} prób</span></article>
            <article className={`drift-${String(professionalLab.decisionCard.driftStatus || 'pending').toLowerCase()}`}><header><small>MODEL DRIFT</small><b>{professionalLab.decisionCard.driftStatus || 'PENDING'}</b></header><span>30 / 50 / 100 ostatnich prognoz</span></article>
            <article><header><small>WALK-FORWARD</small><b>{professionalLab.decisionCard.walkForwardSamples || 0}</b></header><span>Brier {professionalLab.decisionCard.walkForwardBrier ? Number(professionalLab.decisionCard.walkForwardBrier).toFixed(3) : '—'}</span></article>
            <article><header><small>SAMPLE SIZE</small><b>{professionalLab.decisionCard.sampleSize || 0}</b></header><span>min. 30 do decyzji BET</span></article>
            <article><header><small>CLV</small><b>{professionalLab.decisionCard.clvPct == null ? '—' : `${Number(professionalLab.decisionCard.clvPct) > 0 ? '+' : ''}${Number(professionalLab.decisionCard.clvPct).toFixed(1)}%`}</b></header><span>{professionalLab.clv?.snapshots ? `${professionalLab.clv.snapshots} snapshotów kursu` : 'zbieranie historii'}</span></article>
          </div>
          <div className="sim-pro-lab-reason-v152"><b>{professionalLab.decisionCard.reason}</b><span>Decision Card używa konserwatywnego prawdopodobieństwa. Symulator nie gwarantuje zysku ani wyniku meczu.</span></div>
          {professionalLab.paperPortfolio ? <div className="sim-shadow-portfolio-v152">
            <header><div><small>PAPER BETTING / SHADOW PORTFOLIO</small><strong>Test rekomendacji bez stawiania pieniędzy</strong></div><span>1.00u / typ</span></header>
            <div>
              <article><small>ROZLICZONE</small><b>{professionalLab.paperPortfolio.settled || 0}</b></article>
              <article><small>PROFIT</small><b className={Number(professionalLab.paperPortfolio.profitUnits || 0) >= 0 ? 'positive' : 'negative'}>{Number(professionalLab.paperPortfolio.profitUnits || 0) > 0 ? '+' : ''}{Number(professionalLab.paperPortfolio.profitUnits || 0).toFixed(2)}u</b></article>
              <article><small>ROI / YIELD</small><b>{Number(professionalLab.paperPortfolio.roi || 0).toFixed(1)}%</b></article>
              <article><small>MAX DRAWDOWN</small><b>-{Number(professionalLab.paperPortfolio.maxDrawdownUnits || 0).toFixed(2)}u</b></article>
              <article><small>W/L STREAK</small><b>{professionalLab.paperPortfolio.maxWinStreak || 0} / {professionalLab.paperPortfolio.maxLoseStreak || 0}</b></article>
              <article><small>AVG CLV</small><b>{Number(professionalLab.paperPortfolio.avgClv || 0) > 0 ? '+' : ''}{Number(professionalLab.paperPortfolio.avgClv || 0).toFixed(1)}%</b></article>
            </div>
          </div> : null}
          {isBetAiLabTestV152(match) ? <footer className="sim-pro-lab-test-note-v152">⚠ TRYB TESTOWY: wszystkie dane tego jednego meczu są kontrolne/offline i NIE są zapisywane do realnego backtestu, portfolio ani Supabase.</footer> : null}
        </section> : null}


        {modelLab ? <section className={`sim-model-dashboard-v166 health-${String(modelLab?.dashboard?.health || 'pending').toLowerCase()}`}>
          <header className="sim-model-dashboard-head-v166">
            <div><small>BET+AI PREDICTION ENGINE 3.0 • V159–V180 ALL-IN</small><strong>Professional Model Dashboard</strong><p>Self Learning • League/Market Models • Adaptive Calibration • Auto Rollback • Match Intelligence 3.0</p></div>
            <span>{String(modelLab?.selection?.activeModel || 'champion').toUpperCase()}</span>
          </header>
          <div className="sim-model-dashboard-grid-v166">
            <article className="primary"><small>ACTIVE MODEL</small><b>{modelLab?.selection?.activeModel === 'challenger' ? 'SELF-LEARNING V180' : 'CHAMPION V158 CORE'}</b><span>{modelLab?.selection?.status || 'COLLECTING'} • {modelLab?.selection?.pairedSamples || 0}/{modelLab?.selection?.requiredSamples || 120} paired</span></article>
            <article><small>CHAMPION BRIER</small><b>{modelLab?.selection?.champion?.avgBrier ? Number(modelLab.selection.champion.avgBrier).toFixed(3) : '—'}</b><span>{modelLab?.selection?.champion?.matches || 0} par</span></article>
            <article><small>CHALLENGER BRIER</small><b>{modelLab?.selection?.challenger?.avgBrier ? Number(modelLab.selection.challenger.avgBrier).toFixed(3) : '—'}</b><span>Δ {Number(modelLab?.selection?.brierDelta || 0) > 0 ? '+' : ''}{Number(modelLab?.selection?.brierDelta || 0).toFixed(4)}</span></article>
            <article className={`gate-${String(modelLab?.autoGate?.status || 'pending').toLowerCase()}`}><small>AUTO-GATE</small><b>{modelLab?.autoGate?.status || 'PENDING'}</b><span>{modelLab?.autoGate?.reason || 'zbieranie historii'}</span></article>
            <article><small>STATISTICAL CONFIDENCE</small><b>{modelLab?.statisticalConfidence?.level || 'PENDING'}</b><span>{modelLab?.statisticalConfidence?.samples || 0} prób rynku</span></article>
            <article><small>SHADOW ROI • 95% CI</small><b>{modelLab?.statisticalConfidence?.portfolioRoi == null ? '—' : `${Number(modelLab.statisticalConfidence.portfolioRoi) > 0 ? '+' : ''}${Number(modelLab.statisticalConfidence.portfolioRoi).toFixed(1)}%`}</b><span>{modelLab?.statisticalConfidence?.roi95 ? `${modelLab.statisticalConfidence.roi95.low}% → ${modelLab.statisticalConfidence.roi95.high}%` : 'brak wystarczającej próby'}</span></article>
            <article><small>DIXON-COLES</small><b>ρ {Number(modelLab?.challenger?.dixonColes?.rho ?? -0.08).toFixed(2)}</b><span>korekta 0:0 • 1:0 • 0:1 • 1:1</span></article>
            <article><small>TEAM STRENGTH • HOME</small><b>{modelLab?.challenger?.teamStrength?.home?.rating || '—'}</b><span>{modelLab?.challenger?.teamStrength?.home?.team || '—'} • {modelLab?.challenger?.teamStrength?.home?.samples || 0} hist.</span></article>
            <article><small>TEAM STRENGTH • AWAY</small><b>{modelLab?.challenger?.teamStrength?.away?.rating || '—'}</b><span>{modelLab?.challenger?.teamStrength?.away?.team || '—'} • {modelLab?.challenger?.teamStrength?.away?.samples || 0} hist.</span></article>
            <article><small>MODEL ↔ MARKET</small><b>{modelLab?.marketValidation?.deltaPp == null ? '—' : `${Number(modelLab.marketValidation.deltaPp) > 0 ? '+' : ''}${modelLab.marketValidation.deltaPp} pp`}</b><span>{modelLab?.marketValidation?.status || 'NO MARKET'} • market nie jest wejściem modelu</span></article>
            <article className={`risk-${String(modelLab?.correlationRisk?.level || 'low').toLowerCase()}`}><small>CORRELATION RISK</small><b>{modelLab?.correlationRisk?.score || 0}/100 • {modelLab?.correlationRisk?.level || 'LOW'}</b><span>max ρ {Number(modelLab?.correlationRisk?.maxCorrelation || 0).toFixed(2)} • ekspozycja ×{Number(modelLab?.correlationRisk?.exposureMultiplier || 1).toFixed(2)}</span></article>
            <article><small>PURE MODEL ENSEMBLE</small><b>{modelLab?.pureEnsemble?.probability || 0}%</b><span>{modelLab?.pureEnsemble?.independentSources || 0} modeli • bez rynku no-vig</span></article>
          </div>
          <div className="sim-model-separation-v166">
            <div><b>V159 • MODEL / MARKET SEPARATION</b><span>{modelLab?.marketValidation?.note || 'Rynek jest tylko warstwą wyceny.'}</span></div>
            <div><b>V160 • CHAMPION / CHALLENGER</b><span>{modelLab?.selection?.reason || 'Challenger zbiera historię.'}</span></div>
            <div><b>V165 • CORRELATION</b><span>{modelLab?.correlationRisk?.note || 'Kontrola wspólnej ekspozycji.'}</span></div>
          </div>
          {modelPerformance?.autoGate?.markets?.length ? <div className="sim-auto-gates-v166">
            {modelPerformance.autoGate.markets.map(item => <span key={item.key} className={`gate-${String(item.status || '').toLowerCase()}`}><small>{item.label}</small><b>{item.status}</b><em>{item.samples} prób • Brier {Number(item.brier || 0).toFixed(3)}</em></span>)}
          </div> : null}
          <div className="sim-self-learning-v174">
            <header><div><small>V167–V174 • SELF LEARNING AI ENGINE</small><strong>Model Brain • automatyczne wagi i governance</strong></div><span>{modelLab?.selfLearning?.governance?.status || 'COLLECTING'}</span></header>
            <div className="sim-self-learning-grid-v174">
              <article><small>SELF-LEARNING SAMPLE</small><b>{modelLab?.dashboard?.selfLearningSamples || 0}</b><span>V180 settled • half-life {modelLab?.dashboard?.halfLifeDays || 90} dni</span></article>
              <article><small>ACTIVE VERSION</small><b>{modelLab?.selfLearning?.governance?.activeVersion === 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL' ? 'V180' : 'V158'}</b><span>{modelLab?.selfLearning?.governance?.rollbackArmed ? 'AUTO-ROLLBACK ARMED' : 'validation in progress'}</span></article>
              <article><small>FEATURE LEADER</small><b>{modelLab?.selfLearning?.featureLab?.[0]?.source || '—'}</b><span>{modelLab?.selfLearning?.featureLab?.[0]?.samples || 0} prób • Brier {Number(modelLab?.selfLearning?.featureLab?.[0]?.brier || 0).toFixed(3)}</span></article>
              <article><small>LEAGUE PROFILE</small><b>{modelLab?.selfLearning?.leagueProfile ? 'AKTYWNY' : 'GLOBAL'}</b><span>{modelLab?.selfLearning?.activeLeague || '—'}</span></article>
              <article><small>LAST WEIGHT CHANGE</small><b>{modelLab?.dashboard?.profileUpdatedAt ? new Date(modelLab.dashboard.profileUpdatedAt).toLocaleDateString('pl-PL') : '—'}</b><span>{modelLab?.selfLearning?.globalWeights ? 'profile audit w Supabase' : 'zbieranie profilu'}</span></article>
            </div>
            {modelLab?.selfLearning?.featureLab?.length ? <div className="sim-feature-lab-v171">{modelLab.selfLearning.featureLab.slice(0,6).map(item => <span key={item.source}><small>#{item.rank} {item.source}</small><b>{item.status}</b><em>{item.samples} • Brier {Number(item.brier || 0).toFixed(3)}</em></span>)}</div> : null}
          </div>
          {modelLab?.matchIntelligence ? <div className="sim-match-intelligence-v180">
            <header><div><small>V175–V180 • MATCH INTELLIGENCE 3.0</small><strong>XI • absencje • fatigue • matchup adjustment</strong></div><span>{modelLab.matchIntelligence.dataConfidence || 0}% DATA</span></header>
            <div>
              <article><small>HOME XI</small><b>{modelLab.matchIntelligence.home?.lineup?.official ? 'OFFICIAL' : modelLab.matchIntelligence.home?.lineup?.available ? 'PREDICTED' : 'BRAK XI'}</b><span>{modelLab.matchIntelligence.home?.lineup?.formation || '—'} • absencje {modelLab.matchIntelligence.home?.injuries?.count || 0}</span></article>
              <article><small>AWAY XI</small><b>{modelLab.matchIntelligence.away?.lineup?.official ? 'OFFICIAL' : modelLab.matchIntelligence.away?.lineup?.available ? 'PREDICTED' : 'BRAK XI'}</b><span>{modelLab.matchIntelligence.away?.lineup?.formation || '—'} • absencje {modelLab.matchIntelligence.away?.injuries?.count || 0}</span></article>
              <article><small>HOME FATIGUE</small><b>{modelLab.matchIntelligence.home?.fatigue?.congestion || 'UNKNOWN'}</b><span>rest {modelLab.matchIntelligence.home?.fatigue?.restDays ?? '—'}d • 7d: {modelLab.matchIntelligence.home?.fatigue?.matches7d || 0} mecze</span></article>
              <article><small>AWAY FATIGUE</small><b>{modelLab.matchIntelligence.away?.fatigue?.congestion || 'UNKNOWN'}</b><span>rest {modelLab.matchIntelligence.away?.fatigue?.restDays ?? '—'}d • 7d: {modelLab.matchIntelligence.away?.fatigue?.matches7d || 0} mecze</span></article>
              <article><small>xG ADJUSTED</small><b>{Number(modelLab.matchIntelligence.adjustedXg?.home || 0).toFixed(2)} – {Number(modelLab.matchIntelligence.adjustedXg?.away || 0).toFixed(2)}</b><span>Δ {Number(modelLab.matchIntelligence.home?.xgAdjustment || 0) >= 0 ? '+' : ''}{Number(modelLab.matchIntelligence.home?.xgAdjustment || 0).toFixed(2)} / {Number(modelLab.matchIntelligence.away?.xgAdjustment || 0) >= 0 ? '+' : ''}{Number(modelLab.matchIntelligence.away?.xgAdjustment || 0).toFixed(2)}</span></article>
              <article><small>GOALKEEPER DATA</small><b>{modelLab.matchIntelligence.goalkeeper?.home?.knownInXI && modelLab.matchIntelligence.goalkeeper?.away?.knownInXI ? 'XI KNOWN' : 'PARTIAL'}</b><span>bez fikcyjnych ratingów zawodników</span></article>
            </div>
          </div> : null}
        </section> : null}

        {ensembleValidation ? <section className={`sim-validation-risk-v158 disagree-${String(ensembleValidation?.disagreement?.status || 'low').toLowerCase()}`}>
          <header className="sim-validation-head-v158">
            <div><small>BET+AI MODEL VALIDATION & RISK LAB • V153–V180</small><strong>Pure Ensemble • Sharp Disagreement • Audit • Error Analysis • Portfolio Risk</strong></div>
            <span className={`health-${String(modelPerformance?.controlCenter?.health || 'pending').toLowerCase()}`}>{modelPerformance?.controlCenter?.health || 'PENDING'}</span>
          </header>
          <div className="sim-ensemble-v158">
            <article className="ensemble-main"><small>ENSEMBLE • {ensembleValidation.label}</small><b>{ensembleValidation.probability}%</b><span>{ensembleValidation.independentSources} niezależnych modeli • Bet+AI {ensembleValidation.modelProbability}%</span></article>
            {(ensembleValidation.sources || []).map(source => <article key={source.id}><small>{source.label}</small><b>{source.probability}%</b><span>waga {Number(source.weight || 0).toFixed(2)}</span></article>)}
            <article className={`disagreement ${String(ensembleValidation?.disagreement?.status || '').toLowerCase()}`}><small>SHARP DISAGREEMENT</small><b>{ensembleValidation?.disagreement?.status || 'LOW'}</b><span>spread {ensembleValidation?.disagreement?.spreadPp || 0} pp • σ {ensembleValidation?.disagreement?.stdPp || 0} pp</span></article>
          </div>
          <div className="sim-validation-grid-v158">
            <article><small>PREDICTION AUDIT TRAIL</small><b>{auditState.captured ? 'AKTYWNY' : forecastSaveState === 'saving' ? 'ZAPISUJĘ' : 'OCZEKUJE'}</b><span>{auditState.hash ? `hash ${auditState.hash.slice(0, 12)}…` : 'snapshot danych, wag i decyzji pre-match'}</span></article>
            <article><small>ERROR ANALYSIS</small><b>{modelPerformance?.errorAnalysis?.losingPredictions || 0}</b><span>{modelPerformance?.errorAnalysis?.categories?.[0]?.label || 'zbieranie realnych błędów modelu'}</span></article>
            <article><small>PORTFOLIO RISK</small><b>{modelPerformance?.portfolioRisk?.riskScore || 0}/100 • {modelPerformance?.portfolioRisk?.level || 'PENDING'}</b><span>vol {Number(modelPerformance?.portfolioRisk?.volatilityUnits || 0).toFixed(2)}u • DD {Number(modelPerformance?.portfolioRisk?.maxDrawdownUnits || 0).toFixed(2)}u</span></article>
            <article><small>MODEL CONTROL CENTER</small><b>{modelPerformance?.controlCenter?.settledPredictions || 0} settled</b><span>Brier {Number(modelPerformance?.controlCenter?.brier || 0).toFixed(3)} • drift {modelPerformance?.controlCenter?.driftCount || 0}/{modelPerformance?.controlCenter?.watchCount || 0}</span></article>
          </div>
          {modelPerformance?.errorAnalysis?.categories?.length ? <div className="sim-error-analysis-v158">
            <small>NAJCZĘSTSZE PRZYCZYNY PRZEGRANYCH PROGNOZ</small>
            <div>{modelPerformance.errorAnalysis.categories.slice(0, 4).map(item => <span key={item.key}><b>{item.label}</b><em>{item.count} • {item.sharePct}%</em></span>)}</div>
          </div> : null}
          {modelPerformance?.portfolioRisk?.rolling ? <div className="sim-risk-windows-v158">
            {['w50','w100','w250'].map(key => { const row = modelPerformance.portfolioRisk.rolling[key]; return <span key={key}><small>{key.toUpperCase()} STRESS</small><b>{Number(row?.medianRoi || 0) > 0 ? '+' : ''}{Number(row?.medianRoi || 0).toFixed(1)}%</b><em>worst {Number(row?.worstRoi || 0).toFixed(1)}% • +ROI {Number(row?.positiveRate || 0).toFixed(0)}%</em></span> })}
          </div> : null}
          {modelPerformance?.controlCenter?.alerts?.length ? <footer className="sim-control-alerts-v158">{modelPerformance.controlCenter.alerts.slice(0, 3).map((alert, index) => <span key={index}>⚠ {alert}</span>)}</footer> : <footer className="sim-control-alerts-v158 ok">✓ Brak aktywnych alarmów jakości modelu.</footer>}
        </section> : null}

        <section className="sim-prep-backtest-v137">
          <div className="sim-prep-backtest-head-v137">
            <div><small>BET+AI BACKTEST & CALIBRATION</small><strong>Rzeczywista skuteczność modelu</strong></div>
            {modelPerformanceLoading ? <span className="loading">● LICZĘ</span> : modelPerformance?.all?.matches ? <span className="live">● {modelPerformance.all.matches} ROZLICZONYCH</span> : <span className="waiting">ZBIERANIE DANYCH</span>}
          </div>
          {modelPerformance?.all?.matches ? <>
            <div className="sim-prep-backtest-kpis-v137">
              <article><small>1X2 ACCURACY</small><b>{modelPerformance.all.oneXTwoAccuracy}%</b><span>{modelPerformance.all.markets?.find(item => item.key === 'oneXTwo')?.samples || 0} meczów</span></article>
              <article><small>BRIER SCORE</small><b>{Number(modelPerformance.all.avgBrier || 0).toFixed(3)}</b><span>niżej = lepiej</span></article>
              <article><small>CALIBRATION LIFT</small><b className={Number(modelPerformance.all.calibrationBrierLift || 0) >= 0 ? 'positive' : 'negative'}>{Number(modelPerformance.all.calibrationBrierLift || 0) > 0 ? '+' : ''}{Number(modelPerformance.all.calibrationBrierLift || 0).toFixed(3)}</b><span>RAW {Number(modelPerformance.all.rawAvgBrier || 0).toFixed(3)}</span></article>
              <article><small>AVG CLV</small><b className={Number(modelPerformance.all.avgClv || 0) >= 0 ? 'positive' : 'negative'}>{Number(modelPerformance.all.avgClv || 0) > 0 ? '+' : ''}{Number(modelPerformance.all.avgClv || 0).toFixed(1)}%</b><span>{modelPerformance.all.clvSamples || 0} closing samples</span></article>
              <article><small>VALUE ROI</small><b className={Number(modelPerformance.all.valueRoi || 0) >= 0 ? 'positive' : 'negative'}>{Number(modelPerformance.all.valueRoi || 0) > 0 ? '+' : ''}{modelPerformance.all.valueRoi}%</b><span>{modelPerformance.all.valueBets || 0} value betów</span></article>
              <article><small>30 DNI</small><b>{modelPerformance.last30?.matches || 0}</b><span>rozliczonych meczów</span></article>
            </div>
            <div className="sim-prep-backtest-markets-v137">
              {(modelPerformance.all.markets || []).filter(item => item.key !== 'oneXTwo').map(item => <span key={item.key}><small>{item.label}</small><b>{item.accuracy}%</b><em>Brier {Number(item.brier || 0).toFixed(3)}</em></span>)}
            </div>
            {modelPerformance.all.calibration?.length ? <div className="sim-prep-calibration-v137">
              <small>KALIBRACJA PEWNOŚCI</small>
              <div>{modelPerformance.all.calibration.slice(-5).map(item => <span key={item.range}><b>{item.range}</b><em>realnie {item.actualAccuracy}%</em><i className={Math.abs(Number(item.calibrationGap || 0)) <= 5 ? 'good' : 'warn'}>{Number(item.calibrationGap || 0) > 0 ? '+' : ''}{item.calibrationGap} pp</i></span>)}</div>
            </div> : null}
            {modelPerformance.note ? <p className="sim-prep-backtest-note-v137">⚠ {modelPerformance.note}</p> : <p className="sim-prep-backtest-note-v137 ok">✓ Wyniki są liczone wyłącznie z zamrożonych prognoz pre-match i prawdziwych rezultatów.</p>}
          </> : <p className="sim-prep-backtest-empty-v137">Pierwsze statystyki pojawią się po zakończeniu i automatycznym rozliczeniu zapisanych prognoz. Forecast po kickoffie jest zablokowany, więc wynik nie może zmienić historycznej predykcji.</p>}
        </section>

        {modelPerformance?.walkForward ? <section className="sim-model-monitor-v152">
          <header><div><small>PROFESSIONAL MODEL MONITORING</small><strong>Walk-Forward • Drift 30/50/100 • Trust Score</strong></div><span>{isBetAiLabTestV152(match) ? 'TEST HISTORY' : 'REAL PRE-MATCH HISTORY'}</span></header>
          <div className="sim-model-monitor-grid-v152">
            <article><small>WALK-FORWARD SAMPLES</small><b>{modelPerformance.walkForward.samples || 0}</b><span>chronologicznie • bez danych z przyszłości</span></article>
            <article><small>WF BRIER</small><b>{Number(modelPerformance.walkForward.walkForwardBrier || 0).toFixed(3)}</b><span>RAW {Number(modelPerformance.walkForward.rawBrier || 0).toFixed(3)} • lift {Number(modelPerformance.walkForward.lift || 0) > 0 ? '+' : ''}{Number(modelPerformance.walkForward.lift || 0).toFixed(3)}</span></article>
            <article><small>MODEL DRIFT</small><b>{professionalLab?.drift?.status || 'PENDING'}</b><span>30: {professionalLab?.drift?.windows?.w30?.samples || 0} • 50: {professionalLab?.drift?.windows?.w50?.samples || 0} • 100: {professionalLab?.drift?.windows?.w100?.samples || 0}</span></article>
            <article><small>LEAGUE TRUST</small><b>{professionalLab?.leagueTrust?.score || 0}/100</b><span>{professionalLab?.leagueTrust?.label || 'PENDING'} • {professionalLab?.leagueTrust?.samples || 0} prób rynku</span></article>
          </div>
        </section> : null}

        <div className={`sim-prep-quality-gate-v126 ${eligibility.eligible ? 'accepted' : 'rejected'}`}>
          <div>
            <strong>{eligibility.eligible ? `✓ ${copy.qualified}` : `✕ ${copy.rejected}`}</strong>
            <span>{eligibility.eligible ? copy.qualifiedDesc : copy.rejectedDesc}</span>
          </div>
          {!eligibility.eligible && eligibility.reasons.length ? <ul>{eligibility.reasons.slice(0, 6).map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
        </div>
        {data.partial && eligibility.eligible ? <div className="sim-prep-partial-v116">ℹ Część danych dodatkowych jest niedostępna, ale wymagane statystyki sportowe spełniają próg jakości.</div> : null}
        <div className="sim-prep-footer-v116">
          <p>{copy.predictive}</p>
          <button type="button" disabled={!eligibility.eligible} className={!eligibility.eligible ? 'blocked-v126' : ''} onClick={() => eligibility.eligible && onStart?.(match, preparedData)}>{eligibility.eligible ? `▶ ${copy.start}` : `✕ ${copy.rejectedButton}`}</button>
        </div>
      </> : null}
    </section>
  )
}
