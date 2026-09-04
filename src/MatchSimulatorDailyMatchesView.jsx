import React, { useEffect, useMemo, useRef, useState } from 'react'


const COPY = {
  pl: {
    title: 'Mecze dnia',
    subtitle: 'Tylko realne mecze z wystarczającą formą i statystykami obu drużyn. Skład XI i kursy są opcjonalne.',
    search: 'Wyszukaj mecz, ligę lub kraj',
    sport: 'Sport',
    football: 'Piłka nożna',
    top: 'Topowe mecze',
    today: 'Dzisiaj',
    open: 'Symuluj',
    more: 'Więcej',
    refresh: 'Odśwież API',
    loading: 'Pobieram i kwalifikuję realne mecze dnia…',
    empty: 'Brak kolejnych meczów z wystarczającymi realnymi statystykami na dzisiaj.',
    error: 'Nie udało się pobrać realnych meczów.',
    real: 'API-Football LIVE',
    odds: 'Realne kursy',
    noOdds: 'Brak kursów',
    nearest: 'NAJBLIŻSZY MECZ',
    startsIn: 'Start za',
  },
  en: {
    title: 'Matches of the day',
    subtitle: 'Only real fixtures with sufficient team form and statistics. Lineups and odds are optional.',
    search: 'Search match, league or country',
    sport: 'Sport',
    football: 'Football',
    top: 'Top matches',
    today: 'Today',
    open: 'Simulate',
    more: 'More',
    refresh: 'Refresh API',
    loading: 'Loading and qualifying real fixtures…',
    empty: 'No more upcoming fixtures with sufficient real statistics today.',
    error: 'Could not load real fixtures.',
    real: 'API-Football LIVE',
    odds: 'Real odds',
    noOdds: 'No odds',
    nearest: 'NEXT MATCH',
    startsIn: 'Starts in',
  }
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
  } catch (_) {
    return 'Europe/London'
  }
}

function getDateKeyInTimeZone(value = Date.now(), timeZone = getBrowserTimeZone()) {
  try {
    const date = value instanceof Date ? value : new Date(value)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date)
    const y = parts.find(part => part.type === 'year')?.value
    const m = parts.find(part => part.type === 'month')?.value
    const d = parts.find(part => part.type === 'day')?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch (_) {}
  const fallback = value instanceof Date ? value : new Date(value)
  return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`
}

function formatKickoffTime(startMs, timeZone = getBrowserTimeZone()) {
  if (!Number.isFinite(startMs)) return '—'
  try {
    return new Intl.DateTimeFormat('pl-PL', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(startMs))
  } catch (_) {
    return new Date(startMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  }
}

function formatDateLabel(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-')
  return y && m && d ? `${d}.${m}.${y}` : dateKey
}

function fixtureKey(row = {}) {
  return String(row.apiFixtureId || row.id || `${row.home}|${row.away}|${row.commence_time}`)
}

function getFixtureStartMs(row = {}) {
  const directCandidates = [
    row.commence_time,
    row.fixture_date,
    row.start_time,
    row.start,
    row.kickoff,
    row.timestamp ? Number(row.timestamp) * 1000 : null,
  ]
  for (const value of directCandidates) {
    if (!value) continue
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Date.parse(String(value))
    if (Number.isFinite(parsed)) return parsed
  }

  const date = String(row.date || '').trim()
  const time = String(row.time || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{1,2}:\d{2}/.test(time)) {
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    // Convert a Europe/Warsaw wall-clock kickoff to UTC without relying on browser timezone.
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: getBrowserTimeZone(),
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(utcGuess))
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
      const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second || 0))
      const zoneOffsetMs = asUtc - utcGuess
      return utcGuess - zoneOffsetMs
    } catch (_) {
      return utcGuess
    }
  }
  return NaN
}

function isPreMatchFixture(row = {}, nowMs = Date.now()) {
  const short = String(row.status_short || row.status || '').toUpperCase()
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'FT', 'AET', 'PEN', 'CANC', 'PST', 'ABD', 'AWD', 'WO'].includes(short)) return false
  const startMs = getFixtureStartMs(row)
  return Number.isFinite(startMs) && startMs > nowMs
}

function isRealApiFootballFixture(row = {}) {
  const source = String(row.source || '').toLowerCase()
  return Boolean(row.apiFixtureId) && source !== 'demo' && !String(row.id || '').startsWith('demo-')
}

function statusText(row = {}) {
  const short = String(row.status_short || '').toUpperCase()
  if (!short || short === 'NS' || short === 'TBD') return 'Zaplanowany'
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(short)) return 'LIVE'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'Zakończony'
  if (short === 'PST') return 'Przełożony'
  if (short === 'CANC') return 'Odwołany'
  return row.status_long || short
}

function formatKickoffCountdown(startMs, nowMs, copy) {
  const diff = Math.max(0, Number(startMs) - Number(nowMs))
  const totalMinutes = Math.floor(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const seconds = Math.floor((diff % 60000) / 1000)
  if (hours > 0) return `${copy.startsIn} ${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${copy.startsIn} ${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function getReal1X2(row = {}) {
  if (!row.hasRealOdds || !Array.isArray(row.markets)) return null
  const items = row.markets.filter(item => String(item.market || '').toLowerCase() === '1x2')
  const home = items.find(item => String(item.pick || '').toLowerCase().includes(String(row.home || '').toLowerCase()) && String(item.pick || '').toLowerCase().includes('wygra'))
  const draw = items.find(item => /remis/i.test(String(item.pick || '')))
  const away = items.find(item => String(item.pick || '').toLowerCase().includes(String(row.away || '').toLowerCase()) && String(item.pick || '').toLowerCase().includes('wygra'))
  if (!home && !draw && !away) return null
  return {
    home: home?.odds ? Number(home.odds).toFixed(2) : '—',
    draw: draw?.odds ? Number(draw.odds).toFixed(2) : '—',
    away: away?.odds ? Number(away.odds).toFixed(2) : '—'
  }
}

function waitFor(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = window.setTimeout(resolve, Math.max(0, Number(ms) || 0))
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

function isRateLimitPayload(response, payload = {}) {
  return response?.status === 429 || Boolean(payload?.rateLimited) || /429|too many requests|rate limit|requests per minute/i.test(String(payload?.error || payload?.message || ''))
}

async function qualifyFixtureForSimulator(row = {}, { signal } = {}) {
  const fixtureId = row.apiFixtureId || row.id
  const homeTeamId = row.homeTeamId || ''
  const awayTeamId = row.awayTeamId || ''
  if (!fixtureId || !homeTeamId || !awayTeamId) return { eligible: false, cached: false, rateLimited: false }
  const params = new URLSearchParams({
    fixture: String(fixtureId),
    quality_only: '1',
    home_team_id: String(homeTeamId),
    away_team_id: String(awayTeamId)
  })
  const delays = [0, 1400, 2800]
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await waitFor(delays[attempt], signal)
    try {
      const response = await fetch(`/.netlify/functions/get-match-simulator-data?${params.toString()}`, { cache: 'no-store', signal })
      const payload = await response.json().catch(() => ({}))
      const eligible = Boolean(response.ok && payload?.ok && payload?.simulationQuality?.eligible)
      if (eligible) return { eligible: true, cached: Boolean(payload?.cached || payload?.rateLimitShield?.cachedResponses), rateLimited: false }
      if (isRateLimitPayload(response, payload) && attempt < delays.length - 1) continue
      return { eligible: false, cached: Boolean(payload?.cached), rateLimited: isRateLimitPayload(response, payload), retryAfterMs: Number(payload?.retryAfterMs || 0) }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      if (attempt >= delays.length - 1) return { eligible: false, cached: false, rateLimited: false }
    }
  }
  return { eligible: false, cached: false, rateLimited: false }
}


const SCANNER_LABELS = {
  home: '1 • Gospodarze', draw: 'X • Remis', away: '2 • Goście',
  over15: 'Over 1.5', under15: 'Under 1.5', over25: 'Over 2.5', under25: 'Under 2.5',
  over35: 'Over 3.5', under35: 'Under 3.5', bttsYes: 'BTTS • TAK', bttsNo: 'BTTS • NIE'
}

function scannerMarketKey(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 'oneXTwo'
  if (['over15', 'under15'].includes(key)) return 'over15'
  if (['over25', 'under25'].includes(key)) return 'over25'
  if (['over35', 'under35'].includes(key)) return 'over35'
  if (['bttsYes', 'bttsNo', 'btts'].includes(key)) return 'btts'
  return key
}

function scannerNormalizeName(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function scannerFindBucket(rows = [], probability = 0) {
  if (!Array.isArray(rows) || probability < 50) return null
  return rows.find(item => {
    const m = String(item?.range || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
    if (!m) return false
    const low = Number(m[1]); const high = Number(m[2])
    return probability >= low && (probability < high || (high >= 100 && probability <= high))
  }) || null
}

function scannerCalibration(performance = null, league = '', candidate = null) {
  const key = scannerMarketKey(candidate?.key || '')
  const globalSummary = performance?.all || null
  const leagueSummary = Array.isArray(performance?.leagues)
    ? performance.leagues.find(item => scannerNormalizeName(item?.name) === scannerNormalizeName(league)) || null
    : null
  const findMarket = summary => summary?.markets?.find(item => item?.key === key) || null
  const globalMarket = findMarket(globalSummary)
  const leagueMarket = findMarket(leagueSummary)
  const useLeague = Boolean(leagueMarket && Number(leagueMarket.samples || 0) >= 30)
  const market = useLeague ? leagueMarket : globalMarket
  const samples = Number(market?.samples || 0)
  const brier = Number(market?.brier || 0)
  const bucket = scannerFindBucket(market?.calibration || [], Number(candidate?.probability || 0))
  const gap = Number(bucket?.calibrationGap || 0)
  const bucketSamples = Number(bucket?.samples || 0)
  let status = 'PENDING'
  if (samples >= 30) {
    if (brier > 0.29 || (bucketSamples >= 10 && Math.abs(gap) > 8)) status = 'POOR'
    else if (bucketSamples >= 10 && Math.abs(gap) <= 5) status = 'GOOD'
    else status = 'OK'
  }
  let score = 45
  if (status === 'GOOD') score = 92
  else if (status === 'OK') score = 76
  else if (status === 'POOR') score = 28
  if (samples >= 100) score = Math.min(100, score + 4)
  return { status, score, samples, brier, source: useLeague ? 'league' : 'global', gap: bucket ? Math.round(gap * 10) / 10 : null }
}

function scannerBaseThreshold(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 6
  if (['bttsYes', 'bttsNo'].includes(key)) return 5.5
  return 5
}

function enrichScannerCandidate(scan = {}, candidate = null, performance = null) {
  if (!candidate) return { decision: 'NO_ODDS', reliability: { score: 0, label: 'BRAK KURSÓW', calibration: { status: 'PENDING', samples: 0 } } }
  const calibration = scannerCalibration(performance, scan?.league || '', candidate)
  const dataQuality = Number(scan?.dataQuality || 0)
  const agreement = Number(scan?.modelAgreement || 0)
  const marketScore = Number(scan?.bookmakerCount || 0) >= 3 ? 92 : Number(scan?.bookmakerCount || 0) >= 1 ? 78 : 35
  const reliabilityScore = Math.round(Math.max(0, Math.min(100, dataQuality * 0.40 + agreement * 0.20 + calibration.score * 0.25 + marketScore * 0.15)))
  let reliabilityLabel = reliabilityScore >= 82 ? 'HIGH' : reliabilityScore >= 68 ? 'MEDIUM' : 'LOW'
  if (calibration.status === 'PENDING') reliabilityLabel = 'PENDING'
  if (calibration.status === 'POOR') reliabilityLabel = 'LOW'

  let threshold = scannerBaseThreshold(candidate.key)
  if (dataQuality < 85) threshold += 2
  if (reliabilityScore < 82) threshold += 1.5
  if (reliabilityScore < 68) threshold += 2
  threshold = Math.round(threshold * 10) / 10

  let decision = 'NO_BET'
  let reason = 'Brak przewagi ponad wymagany próg.'
  if (calibration.status === 'PENDING') reason = `Kalibracja: ${calibration.samples}/30 prób.`
  else if (calibration.status === 'POOR') reason = 'Historyczna kalibracja tego rynku jest słaba.'
  else if (reliabilityScore < 65) reason = 'Za niska wiarygodność modelu dla tego meczu.'
  else if (Number(candidate.edgePp || 0) >= threshold + 4 && Number(candidate.expectedValuePct || 0) >= 8 && reliabilityScore >= 80) {
    decision = 'STRONG_VALUE'; reason = 'Duża przewaga cenowa i wysoka wiarygodność.'
  } else if (Number(candidate.edgePp || 0) >= threshold && Number(candidate.expectedValuePct || 0) >= 3) {
    decision = 'VALUE'; reason = 'Przewaga przekracza próg po kontroli kalibracji.'
  } else if (Number(candidate.edgePp || 0) > 0 && Number(candidate.expectedValuePct || 0) > 0) {
    decision = 'SMALL_EDGE'; reason = 'Dodatni edge, ale poniżej bezpiecznego progu.'
  }
  return {
    ...candidate,
    threshold,
    decision,
    reason,
    reliability: { score: reliabilityScore, label: reliabilityLabel, calibration, modelAgreement: agreement, dataQuality }
  }
}

function enrichScannerResult(scan = {}, performance = null) {
  const candidates = (scan?.candidates || []).map(item => enrichScannerCandidate(scan, item, performance))
  const priority = { STRONG_VALUE: 5, VALUE: 4, SMALL_EDGE: 3, NO_BET: 2, NO_ODDS: 1 }
  candidates.sort((a, b) => (priority[b.decision] || 0) - (priority[a.decision] || 0) || Number(b.edgePp || 0) - Number(a.edgePp || 0))
  return { ...scan, candidates, topFinal: candidates[0] || enrichScannerCandidate(scan, null, performance) }
}

function scannerDecisionLabel(value = '') {
  return ({ STRONG_VALUE: 'STRONG VALUE', VALUE: 'VALUE', SMALL_EDGE: 'SMALL EDGE', NO_BET: 'NO BET', NO_ODDS: 'BRAK KURSÓW' })[String(value || '').toUpperCase()] || value
}

export default function MatchSimulatorDailyMatchesView({ lang = 'pl', onSelectMatch }) {
  const copy = COPY[lang] || COPY.pl
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [qualifying, setQualifying] = useState(false)
  const [error, setError] = useState('')
  const [sourceMessage, setSourceMessage] = useState('')
  const [qualificationProgress, setQualificationProgress] = useState({ done: 0, total: 0 })
  const [selectedId, setSelectedId] = useState('')
  const [scannerResults, setScannerResults] = useState({})
  const [scannerProgress, setScannerProgress] = useState({ done: 0, total: 0 })
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerPerformance, setScannerPerformance] = useState(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const scanAbortRef = useRef(null)
  const clientTimeZone = useMemo(() => getBrowserTimeZone(), [])
  const todayKey = useMemo(() => getDateKeyInTimeZone(nowMs, clientTimeZone), [nowMs, clientTimeZone])

  const normalizeRealRows = (payload, requestNowMs = Date.now()) => {
    const seen = new Set()
    return (Array.isArray(payload?.fixtures) ? payload.fixtures : [])
      .filter(isRealApiFootballFixture)
      .filter(row => isPreMatchFixture(row, requestNowMs))
      .filter(row => getDateKeyInTimeZone(getFixtureStartMs(row), clientTimeZone) === todayKey)
      .filter(row => {
        const key = fixtureKey(row)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => getFixtureStartMs(a) - getFixtureStartMs(b))
  }

  const requestDailyMatches = async ({ forceRefresh = false, skipOdds = true, signal } = {}) => {
    const params = new URLSearchParams({
      sport: 'Piłka nożna',
      country: 'Wszystkie',
      league: 'Wszystkie ligi',
      date: todayKey,
      daysAhead: '0',
      allLeagues: '1',
      mode: 'all-today',
      realOnly: '1',
      forceRefresh: forceRefresh ? '1' : '0',
      skipOdds: skipOdds ? '1' : '0',
      timezone: clientTimeZone
    })
    const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}`, { cache: 'no-store', signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.error || copy.error)
    return payload
  }

  const scanQualifiedMatches = async (rows = [], signal) => {
    setScannerResults({})
    setScannerProgress({ done: 0, total: rows.length })
    if (!rows.length) { setScannerActive(false); return }
    setScannerActive(true)
    for (let i = 0; i < rows.length; i += 1) {
      if (signal?.aborted) return
      const row = rows[i]
      const params = new URLSearchParams({
        fixture: String(row.apiFixtureId || row.id || ''),
        home_team_id: String(row.homeTeamId || ''),
        away_team_id: String(row.awayTeamId || ''),
        home: String(row.home || ''), away: String(row.away || ''),
        league: String(row.league || ''), country: String(row.country || ''),
        fixture_date: String(row.commence_time || row.fixture_date || row.rawDate || '')
      })
      try {
        const response = await fetch(`/.netlify/functions/get-match-value-scan?${params.toString()}`, { cache: 'no-store', signal })
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload?.ok) {
          setScannerResults(prev => ({ ...prev, [fixtureKey(row)]: payload }))
        }
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
      setScannerProgress({ done: i + 1, total: rows.length })
      if (i < rows.length - 1) await waitFor(320, signal)
    }
    if (!signal?.aborted) setScannerActive(false)
  }

  const loadMatches = async (signal) => {
    setLoading(true)
    setError('')
    setScannerResults({})
    setScannerProgress({ done: 0, total: 0 })
    setScannerActive(false)
    try {
      const requestNowMs = Date.now()
      let payload = null
      let realRows = []
      let usedFallback = false

      // Najpierw cache listy dnia; tylko gdy go brakuje robimy jeden świeży refresh.
      try {
        payload = await requestDailyMatches({ forceRefresh: false, skipOdds: true, signal })
        realRows = normalizeRealRows(payload, requestNowMs)
      } catch (error) {
        if (error?.name === 'AbortError') return
      }

      if (!realRows.length && !signal?.aborted) {
        try {
          payload = await requestDailyMatches({ forceRefresh: true, skipOdds: true, signal })
          realRows = normalizeRealRows(payload, requestNowMs)
        } catch (error) {
          if (error?.name === 'AbortError') return
          await waitFor(1800, signal)
          payload = await requestDailyMatches({ forceRefresh: false, skipOdds: true, signal })
          realRows = normalizeRealRows(payload, requestNowMs)
          usedFallback = true
        }
      }

      if (signal?.aborted) return
      setMatches([])
      setLoading(false)
      setQualifying(true)
      setQualificationProgress({ done: 0, total: realRows.length })
      setSourceMessage(realRows.length ? `Rate Limit Shield • sprawdzam jakość 0/${realRows.length}…` : 'Brak kolejnych nierozpoczętych meczów na dzisiaj.')

      const approved = []
      // WERSJA 138: tylko 2 mecze jednocześnie. Każdy pre-check wymaga maks. 2
      // requestów formy, a backend dodatkowo rozstawia je globalnie w czasie.
      const concurrency = 2
      let rateLimitHits = 0
      let cacheHits = 0
      for (let i = 0; i < realRows.length; i += concurrency) {
        if (signal?.aborted) return
        const batch = realRows.slice(i, i + concurrency)
        const verdicts = await Promise.all(batch.map(async row => ({ row, verdict: await qualifyFixtureForSimulator(row, { signal }) })))
        if (signal?.aborted) return
        verdicts.forEach(item => {
          if (item.verdict?.eligible) approved.push(item.row)
          if (item.verdict?.cached) cacheHits += 1
          if (item.verdict?.rateLimited) rateLimitHits += 1
        })
        approved.sort((a, b) => getFixtureStartMs(a) - getFixtureStartMs(b))
        const done = Math.min(realRows.length, i + batch.length)
        setMatches([...approved])
        setQualificationProgress({ done, total: realRows.length })
        setSourceMessage(`Rate Limit Shield • ${done}/${realRows.length} • gotowe ${approved.length} • cache ${cacheHits}${rateLimitHits ? ` • auto-retry ${rateLimitHits}` : ''}${usedFallback ? ' • fallback' : ''}`)

        // Krótka pauza między batchami zapobiega burstowi 300/min. Snapshot/cache
        // powoduje, że kolejne wejścia są dużo szybsze i praktycznie nie zużywają API.
        if (done < realRows.length) await waitFor(rateLimitHits ? 950 : 450, signal)
      }
      if (signal?.aborted) return
      if (!realRows.length) {
        setSourceMessage('Brak kolejnych nierozpoczętych meczów na dzisiaj.')
      } else if (!approved.length) {
        setSourceMessage(`Sprawdzono ${realRows.length}/${realRows.length} • brak meczów spełniających próg realnych statystyk.`)
      } else {
        setSourceMessage(`${approved.length} zakwalifikowanych • Rate Limit Shield aktywny • cache ${cacheHits}`)
      }
      setQualifying(false)
      if (approved.length && !signal?.aborted) await scanQualifiedMatches([...approved], signal)
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) return
      setMatches([])
      setQualificationProgress({ done: 0, total: 0 })
      setQualifying(false)
      setError(err?.message || copy.error)
      setSourceMessage('')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const startLoadMatches = () => {
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    loadMatches(controller.signal)
  }

  useEffect(() => {
    const controller = new AbortController()
    scanAbortRef.current?.abort()
    scanAbortRef.current = controller
    loadMatches(controller.signal)
    return () => controller.abort()
  }, [todayKey, clientTimeZone])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/.netlify/functions/get-match-prediction-performance?limit=5000', { cache: 'no-store' })
      .then(response => response.json().catch(() => ({})).then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!cancelled && response.ok && payload?.ok && payload?.available) setScannerPerformance(payload)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const availableMatches = useMemo(() => matches
    .filter(match => isPreMatchFixture(match, nowMs))
    .filter(match => getDateKeyInTimeZone(getFixtureStartMs(match), clientTimeZone) === todayKey)
    .sort((a, b) => getFixtureStartMs(a) - getFixtureStartMs(b)), [matches, nowMs, todayKey, clientTimeZone])

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableMatches
    return availableMatches.filter(match => [match.home, match.away, match.league, match.country].join(' ').toLowerCase().includes(q))
  }, [query, availableMatches])

  const scannerEntries = useMemo(() => {
    const allowed = new Map(availableMatches.map(match => [fixtureKey(match), match]))
    return Object.entries(scannerResults)
      .filter(([key]) => allowed.has(key))
      .map(([key, raw]) => ({ key, match: allowed.get(key), scan: enrichScannerResult(raw, scannerPerformance) }))
      .filter(item => item.scan?.topFinal)
      .sort((a, b) => {
        const priority = { STRONG_VALUE: 5, VALUE: 4, SMALL_EDGE: 3, NO_BET: 2, NO_ODDS: 1 }
        const ad = priority[a.scan.topFinal.decision] || 0
        const bd = priority[b.scan.topFinal.decision] || 0
        return bd - ad || Number(b.scan.topFinal.edgePp || 0) - Number(a.scan.topFinal.edgePp || 0) || Number(b.scan.topFinal.reliability?.score || 0) - Number(a.scan.topFinal.reliability?.score || 0)
      })
  }, [scannerResults, scannerPerformance, availableMatches])

  const nearestKey = availableMatches.length ? fixtureKey(availableMatches[0]) : ''

  const handleSelect = (match) => {
    if (!isPreMatchFixture(match, Date.now())) {
      setNowMs(Date.now())
      return
    }
    setSelectedId(fixtureKey(match))
    // Natychmiast zatrzymujemy skan dnia, żeby requesty listy nie konkurowały
    // z pełną analizą wybranego meczu o limit API-Football.
    scanAbortRef.current?.abort()
    onSelectMatch?.(match)
  }

  return (
    <section className="sim-day-page-v98 sim-day-real-v99">
      <section className="sim-day-hero-v100" aria-label="Symulator AI hero">
        <img src="/symulator-ai-hero-banner-v100.png" alt="Bet+AI Football Manager AI – realna symulacja meczu" />
      </section>

      <div className="sim-day-layout-v98">
        <aside className="sim-day-sidebar-v98">
          <div className="sim-day-searchbox-v98">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} />
          </div>
          <div className="sim-day-sidegroup-v98">
            <strong>{copy.sport}</strong>
            <div className="sim-day-sportlist-v98">
              <button type="button" className="active"><span>⚽</span>{copy.football}</button>
            </div>
          </div>
          <div className="sim-day-api-state-v99">
            <span className="live">● LIVE API</span>
            <b>{availableMatches.length}</b>
            <small>{sourceMessage || (loading ? copy.loading : copy.real)}</small>
          </div>
        </aside>

        <div className="sim-day-main-v98">
          {loading && <div className="sim-day-loading-v99"><i /><strong>{copy.loading}</strong><span>API-Football • {formatDateLabel(todayKey)}</span></div>}
          {!loading && error && <div className="sim-day-error-v99">⚠ {error}<button type="button" onClick={startLoadMatches}>{copy.refresh}</button></div>}
          {!loading && !error && qualifying && !filteredMatches.length && <div className="sim-day-loading-v99"><i /><strong>Sprawdzam realne statystyki meczów…</strong><span>{qualificationProgress.done}/{qualificationProgress.total} sprawdzonych</span></div>}
          {!loading && !error && !qualifying && !filteredMatches.length && <div className="sim-day-empty-v98">{copy.empty}</div>}

          {!loading && !error && (scannerActive || scannerEntries.length > 0) ? <section className="sim-value-scanner-v139">
            <div className="sim-value-scanner-head-v139">
              <div><small>BET+AI • MODEL RELIABILITY</small><strong>AI VALUE SCANNER</strong><p>Skanuje tylko zakwalifikowane mecze. Pełna analiza po wejściu w mecz jest końcową weryfikacją.</p></div>
              <div className="sim-value-scanner-progress-v139"><b>{scannerProgress.done}/{scannerProgress.total}</b><span>{scannerActive ? 'SKANOWANIE LIVE' : 'SKAN GOTOWY'}</span></div>
            </div>
            {scannerEntries.length ? <div className="sim-value-scanner-grid-v139">
              {scannerEntries.slice(0, 6).map(({ key, match: scanMatch, scan }, index) => {
                const item = scan.topFinal
                const rel = item.reliability || {}
                return <button type="button" key={`scan-${key}`} className={`sim-value-scanner-card-v139 ${String(item.decision || '').toLowerCase()}`} onClick={() => handleSelect(scanMatch)}>
                  <header><span>#{index + 1} • {scanMatch.league}</span><em>{scannerDecisionLabel(item.decision)}</em></header>
                  <strong>{scanMatch.home} <i>vs</i> {scanMatch.away}</strong>
                  <div className="sim-value-scanner-pick-v139"><b>{SCANNER_LABELS[item.key] || item.key || 'Brak rynku'}</b><span>{item.bookmakerOdds ? `@ ${Number(item.bookmakerOdds).toFixed(2)}` : 'bez kursu'}</span></div>
                  <div className="sim-value-scanner-metrics-v139">
                    <span><small>BET+AI</small><b>{item.probability ? `${item.probability}%` : '—'}</b></span>
                    <span><small>FAIR</small><b>{item.fairOdds ? Number(item.fairOdds).toFixed(2) : '—'}</b></span>
                    <span><small>EDGE</small><b>{Number.isFinite(Number(item.edgePp)) ? `${Number(item.edgePp) > 0 ? '+' : ''}${item.edgePp} pp` : '—'}</b></span>
                    <span><small>RELIABILITY</small><b>{rel.score || 0}/100</b></span>
                  </div>
                  <footer><span className={`rel-${String(rel.label || 'pending').toLowerCase()}`}>{rel.label || 'PENDING'}</span><small>{rel.calibration?.samples || 0} prób • model agreement {scan.modelAgreement || 0}%</small></footer>
                </button>
              })}
            </div> : <div className="sim-value-scanner-empty-v139"><i />Szukam przewag cenowych i sprawdzam kalibrację…</div>}
          </section> : null}

          {!loading && !error && filteredMatches.map((match) => {
            const odds = getReal1X2(match)
            const key = fixtureKey(match)
            const startMs = getFixtureStartMs(match)
            const isNearest = key === nearestKey
            return (
              <article key={key} className={`sim-day-matchrow-v98 sim-day-realrow-v99 ${isNearest ? 'nearest-v117' : ''} ${selectedId === key ? 'selected' : ''}`}>
                <div className="sim-day-matchmeta-v98">
                  <div className="sim-day-matchmeta-left-v117">
                    <small>⚽ {match.league} <em>• {match.country || 'Świat'}</em></small>
                    {isNearest ? <div className="sim-day-nearest-line-v117"><strong>⚡ {copy.nearest}</strong><span>{formatKickoffCountdown(startMs, nowMs, copy)}</span></div> : null}
                  </div>
                </div>
                <div className="sim-day-matchcontent-v98">
                  <div className="sim-day-teamblock-v98 sim-day-teamblock-real-v99">
                    <div className="sim-day-team-v99">
                      {match.homeLogo ? <img src={match.homeLogo} alt="" /> : <i>⚽</i>}
                      <strong>{match.home}</strong>
                    </div>
                    <span>{copy.today}<b>{formatKickoffTime(startMs, clientTimeZone)}</b></span>
                    <div className="sim-day-team-v99 away">
                      {match.awayLogo ? <img src={match.awayLogo} alt="" /> : <i>⚽</i>}
                      <strong>{match.away}</strong>
                    </div>
                  </div>

                  {odds ? <div className="sim-day-odds-v99" title={copy.odds}><span>1 <b>{odds.home}</b></span><span>X <b>{odds.draw}</b></span><span>2 <b>{odds.away}</b></span></div> : <div className="sim-day-noodds-v99">{copy.noOdds}</div>}

                  <div className="sim-day-actions-v98">
                    <button type="button" onClick={() => handleSelect(match)}>{copy.open}</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
