import React, { useEffect, useMemo, useRef, useState } from 'react'

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
  const oddsReady = hasRealOdds(match)
  const homeStatsSource = data?.teamStats?.home?.source === 'recent-fixtures' ? `${data?.teamStats?.home?.sampleSize || 0} ostatnich` : 'sezon'
  const awayStatsSource = data?.teamStats?.away?.source === 'recent-fixtures' ? `${data?.teamStats?.away?.sampleSize || 0} ostatnich` : 'sezon'
  const lineupDetail = bothOfficial
    ? copy.official
    : lineupsReady && predictedSides.length
      ? `${copy.predicted} • ${predictedConfidence || '—'}% • ${sourceMatches || predictedSides[0]?.sourceMatches || 0} ostatnie składy`
      : copy.lineupsPending

  return [
    { key: 'odds', label: copy.odds, ready: oddsReady, required: false, detail: oddsReady ? copy.liveOdds : `${copy.noOdds} • opcjonalne` },
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

function buildForecast(match = {}, data = {}, consensus = null, checks = []) {
  const stats = data?.teamStats || {}
  const recent = data?.recent || {}
  const prediction = data?.prediction || {}
  const injuries = data?.injuries || {}

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

  // Web/expert O2.5 is a secondary signal only; it nudges the total-goals profile.
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

  const webWeight = webPercent ? clampNum(0.08 + Number(consensus?.consensus?.agreement || 0) / 100 * 0.08 + Math.min(6, Number(consensus?.consensus?.sourceCount || 0)) * 0.01, 0.08, 0.20) : 0
  const apiWeight = apiPercent ? 0.22 : 0
  const statsWeight = 0.58
  const oneXTwo = weightedTriplet([
    { value: poisson.oneXTwo, weight: statsWeight },
    { value: apiPercent, weight: apiWeight },
    { value: webPercent, weight: webWeight }
  ]) || poisson.oneXTwo

  const goalsWeight = consensus?.goals?.available && externalGoalSources > 0
    ? clampNum(0.12 + Number(consensus?.goals?.confidence || 0) / 100 * 0.10, 0.12, 0.22)
    : 0
  const over25 = goalsWeight > 0 ? poisson.over25 * (1 - goalsWeight) + externalOver25 * goalsWeight : poisson.over25
  const externalBtts = Number(consensus?.goals?.bttsYes || 0)
  const bttsWeight = consensus?.goals?.bttsAvailable && externalBtts > 0 ? Math.min(0.18, goalsWeight || 0.12) : 0
  const btts = bttsWeight > 0 ? poisson.btts * (1 - bttsWeight) + externalBtts * bttsWeight : poisson.btts

  const markets = {
    home: round1(oneXTwo.home),
    draw: round1(oneXTwo.draw),
    away: round1(oneXTwo.away),
    over15: round1(poisson.over15),
    over25: round1(over25),
    over35: round1(poisson.over35),
    btts: round1(btts)
  }
  const fair = Object.fromEntries(Object.entries(markets).map(([key, value]) => [key, fairOdd(value)]))
  const odds = extractMarketOdds(match)
  const valueCandidates = Object.entries(odds).map(([key, quote]) => {
    const probability = Number(markets[key] || 0)
    if (!probability) return null
    const edge = (probability / 100 * Number(quote.odds) - 1) * 100
    return { key, probability, fairOdds: fair[key], bookmakerOdds: round2(quote.odds), edge: round1(edge), bookmaker: quote.bookmaker || '', pick: quote.pick || '' }
  }).filter(Boolean).sort((a, b) => b.edge - a.edge)
  const topValue = valueCandidates[0] || null
  const dataQuality = buildDataQuality(checks, data, consensus)
  const sourceCount = Number(consensus?.consensus?.sourceCount || 0)
  const agreement = Number(consensus?.consensus?.agreement || 0)
  const valueDetected = Boolean(topValue && topValue.edge >= 4 && dataQuality >= 70)
  const valueState = !valueCandidates.length ? 'NO_ODDS' : valueDetected ? 'VALUE' : 'NO_BET'

  const factors = [
    `Forma: ${Math.round(homeForm)}–${Math.round(awayForm)}`,
    `Gole/mecz: ${round2(homeGF)}–${round2(awayGF)}`,
    `Tracone/mecz: ${round2(homeGA)}–${round2(awayGA)}`
  ]
  if (data?.h2h?.summary?.count) factors.push(`H2H: ${data.h2h.summary.count} meczów • śr. ${round2(data.h2h.summary.avgGoals)} gola`)
  if (sourceCount) factors.push(`Web consensus: ${sourceCount} źródeł • zgodność ${Math.round(agreement)}%`)

  return {
    version: 'BETAI_FORECAST_V1',
    generatedAt: new Date().toISOString(),
    fixtureId: String(match?.apiFixtureId || match?.id || data?.fixture?.id || ''),
    xg: { home: round2(homeXg), away: round2(awayXg) },
    oneXTwo: { home: round1(oneXTwo.home), draw: round1(oneXTwo.draw), away: round1(oneXTwo.away) },
    goals: { over15: markets.over15, over25: markets.over25, over35: markets.over35, btts: markets.btts },
    fairOdds: fair,
    topScores: poisson.topScores.slice(0, 3).map(item => ({ score: item.score, probability: round1(item.probability) })),
    dataQuality,
    consensus: { sourceCount, agreement: Math.round(agreement), available: Boolean(webPercent) },
    value: { state: valueState, detected: valueDetected, top: topValue, candidates: valueCandidates.slice(0, 6) },
    factors,
    modelInputs: { homeGF: round2(homeGF), homeGA: round2(homeGA), awayGF: round2(awayGF), awayGA: round2(awayGA), homeForm: Math.round(homeForm), awayForm: Math.round(awayForm) }
  }
}

function forecastLabel(key) {
  return ({ home: '1', draw: 'X', away: '2', over15: 'Over 1.5', over25: 'Over 2.5', over35: 'Over 3.5', btts: 'BTTS TAK' })[key] || key
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
  const mountedRef = useRef(true)
  const forecastSavedRef = useRef('')

  const loadConsensus = async (payload) => {
    const fixture = payload?.fixture || {}
    const params = new URLSearchParams({
      home: fixture?.home?.name || match?.home || '',
      away: fixture?.away?.name || match?.away || '',
      league: fixture?.league || match?.league || '',
      country: fixture?.country || match?.country || '',
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
    setProgress(4)
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?fixture=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać danych symulacji')
      if (!mountedRef.current) return
      setData(payload)
      setProgress(100)
      loadConsensus(payload)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.message || 'Błąd danych symulacji')
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

  const checks = useMemo(() => data ? buildChecks(match, data, copy) : [], [match, data, copy])
  const completeness = useMemo(() => {
    if (Number.isFinite(Number(data?.simulationQuality?.score))) return Math.round(Number(data.simulationQuality.score))
    if (!checks.length) return 0
    const required = checks.filter(item => item.required)
    return Math.round(required.filter(item => item.ready).length * 100 / Math.max(1, required.length))
  }, [checks, data])
  const eligibility = useMemo(() => data ? buildEligibility(match, data, checks) : { eligible: false, reasons: [] }, [match, data, checks])
  const forecast = useMemo(() => data && eligibility.eligible ? buildForecast(match, data, consensus, checks) : null, [match, data, consensus, checks, eligibility.eligible])
  const preparedData = useMemo(() => data ? { ...data, externalConsensus: consensus || null, predictionEngine: forecast || null } : null, [data, consensus, forecast])
  const phaseIndex = Math.min(phases.length - 1, Math.floor(progress / (100 / phases.length)))

  useEffect(() => {
    if (!forecast || !eligibility.eligible || consensusLoading) return
    const fixtureId = String(match?.apiFixtureId || match?.id || data?.fixture?.id || '')
    if (!fixtureId) return
    const signature = `${fixtureId}|${forecast.version}|${forecast.dataQuality}|${forecast.consensus.sourceCount}|${forecast.xg.home}|${forecast.xg.away}`
    if (forecastSavedRef.current === signature) return
    forecastSavedRef.current = signature
    setForecastSaveState('saving')
    fetch('/.netlify/functions/save-match-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixtureId,
        fixtureDate: data?.fixture?.date || match?.rawDate || match?.date || null,
        homeTeam: data?.fixture?.home?.name || match?.home || '',
        awayTeam: data?.fixture?.away?.name || match?.away || '',
        league: data?.fixture?.league || match?.league || '',
        country: data?.fixture?.country || match?.country || '',
        forecast,
        consensus: consensus || null
      })
    }).then(response => response.json().catch(() => ({})).then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!mountedRef.current) return
        setForecastSaveState(response.ok && payload?.ok ? 'saved' : 'local')
      })
      .catch(() => { if (mountedRef.current) setForecastSaveState('local') })
  }, [forecast, eligibility.eligible, consensusLoading, match, data, consensus])

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
          <strong>{match?.home || '—'}</strong>
        </div>
        <div className="sim-prep-vs-v116">
          <small>{match?.league || 'Mecz'}</small>
          <b>VS</b>
          <span>{match?.time || '—'}</span>
        </div>
        <div className="sim-prep-team-v116 away">
          <strong>{match?.away || '—'}</strong>
          {match?.awayLogo ? <img src={match.awayLogo} alt="" /> : null}
        </div>
      </div>

      <div className="sim-prep-loader-v116">
        <div className="sim-prep-loader-top-v116">
          <div><small>{loading ? copy.loading : error ? 'BŁĄD' : copy.ready}</small><strong>{error || phases[phaseIndex]}</strong></div>
          <b>{loading ? progress : data ? 100 : progress}%</b>
        </div>
        <div className="sim-prep-track-v116"><i style={{ width: `${loading ? progress : data ? 100 : progress}%` }} /></div>
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
            <div><small>BET+AI PREDICTION ENGINE V1</small><strong>Prognoza przedmeczowa</strong></div>
            <div className="sim-prep-forecast-badges-v136"><span>DATA {forecast.dataQuality}/100</span><span>{forecast.consensus.sourceCount ? `CONSENSUS ${forecast.consensus.sourceCount}` : 'MODEL DATA'}</span>{forecastSaveState === 'saved' ? <span className="saved">SUPABASE ✓</span> : null}</div>
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

          <div className="sim-prep-forecast-bottom-v136">
            <div className="sim-prep-scorelines-v136"><small>NAJBARDZIEJ PRAWDOPODOBNE WYNIKI</small><div>{forecast.topScores.map(item => <span key={item.score}><b>{item.score}</b><em>{item.probability}%</em></span>)}</div></div>
            <div className={`sim-prep-value-v136 ${forecast.value.state.toLowerCase()}`}>
              <small>BET+AI VALUE ENGINE</small>
              {forecast.value.state === 'VALUE' && forecast.value.top ? <><strong>VALUE DETECTED</strong><b>{forecastLabel(forecast.value.top.key)} @ {forecast.value.top.bookmakerOdds.toFixed(2)}</b><span>Model {forecast.value.top.probability}% • fair {forecast.value.top.fairOdds.toFixed(2)} • edge +{forecast.value.top.edge}%</span></> : forecast.value.state === 'NO_BET' && forecast.value.top ? <><strong>NO BET</strong><b>Brak wystarczającej przewagi</b><span>Najlepszy edge: {forecast.value.top.edge > 0 ? '+' : ''}{forecast.value.top.edge}%</span></> : <><strong>VALUE NIEOCENIONE</strong><b>Brak realnych kursów</b><span>Prognoza probabilistyczna nadal jest dostępna.</span></>}
            </div>
          </div>

          <div className="sim-prep-factors-v136">{forecast.factors.slice(0, 5).map(factor => <span key={factor}>{factor}</span>)}</div>
          <p className="sim-prep-forecast-note-v136">Prawdopodobieństwa są estymacją modelu, nie gwarancją wyniku. Animacja meczu korzysta z tego profilu xG i 1X2.</p>
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
