const { recordPredictionSnapshots, getPredictionStats } = require('./_lib/ai-prediction-history')
const API_SPORTS_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'
const TIMEZONE = process.env.BETAI_PREDICTIONS_TIMEZONE || 'Europe/Warsaw'

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=300',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  }
}

function clamp(value, min, max) {
  const number = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min))
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round((Number(value) || 0) * factor) / factor
}

function median(values = []) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function dateKeyInTimezone(value = new Date(), timeZone = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function dateKeysCoveringWindow(hours) {
  const keys = new Set()
  const now = Date.now()
  const steps = Math.max(2, Math.ceil(hours / 12) + 1)
  for (let index = 0; index <= steps; index += 1) {
    keys.add(dateKeyInTimezone(new Date(now + index * 12 * 60 * 60 * 1000)))
  }
  return [...keys]
}

function parsePercentage(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(String(value).replace('%', '').replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeThree(values) {
  const clean = values.map(value => Math.max(0, Number(value) || 0))
  const sum = clean.reduce((total, value) => total + value, 0)
  if (!sum) return [0, 0, 0]
  return clean.map(value => value / sum * 100)
}

function classifyStatus(status = {}) {
  const short = String(status.short || status.long || '').toUpperCase()
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'live'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['PST', 'CANC', 'ABD', 'AWD', 'WO', 'SUSP'].includes(short)) return 'blocked'
  return 'upcoming'
}

async function apiFetch(path, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'x-apisports-key': API_SPORTS_KEY },
      signal: controller.signal
    })
    const text = await response.text()
    let payload = null
    try { payload = JSON.parse(text) } catch (_) { payload = null }
    const apiErrors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
    if (!response.ok || (apiErrors && Object.keys(apiErrors).length)) {
      const message = apiErrors && Object.keys(apiErrors).length ? JSON.stringify(apiErrors) : text.slice(0, 300)
      throw new Error(`API-Football ${response.status}: ${message}`)
    }
    return payload || {}
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchFixtures(date) {
  const payload = await apiFetch(`/fixtures?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(TIMEZONE)}`)
  return Array.isArray(payload.response) ? payload.response : []
}

async function fetchOdds(date, maxPages = 4) {
  const rows = []
  let page = 1
  while (page <= maxPages) {
    const payload = await apiFetch(`/odds?date=${encodeURIComponent(date)}&page=${page}`)
    const response = Array.isArray(payload.response) ? payload.response : []
    rows.push(...response)
    const current = Number(payload?.paging?.current || page)
    const total = Number(payload?.paging?.total || 1)
    if (!response.length || current >= total) break
    page += 1
  }
  return rows
}

function normalizeOutcomeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['home', '1'].includes(normalized)) return 'home'
  if (['draw', 'x'].includes(normalized)) return 'draw'
  if (['away', '2'].includes(normalized)) return 'away'
  return ''
}

function buildOddsMap(rows = []) {
  const map = new Map()
  rows.forEach(row => {
    const fixtureId = String(row?.fixture?.id || row?.fixture_id || '')
    if (!fixtureId) return
    const outcomeRows = { home: [], draw: [], away: [] }
    const bookmakers = Array.isArray(row.bookmakers) ? row.bookmakers : []
    bookmakers.forEach(bookmaker => {
      const bookmakerName = String(bookmaker?.name || 'Bukmacher')
      const bets = Array.isArray(bookmaker?.bets) ? bookmaker.bets : []
      bets.forEach(bet => {
        const marketName = String(bet?.name || '').toLowerCase().trim()
        if (!['match winner', 'winner', '1x2', 'fulltime result', 'full time result'].includes(marketName)) return
        const values = Array.isArray(bet?.values) ? bet.values : []
        values.forEach(value => {
          const outcome = normalizeOutcomeLabel(value?.value)
          const odd = Number(String(value?.odd ?? '').replace(',', '.'))
          if (!outcome || !Number.isFinite(odd) || odd <= 1) return
          outcomeRows[outcome].push({ odd, bookmaker: bookmakerName })
        })
      })
    })

    if (!outcomeRows.home.length || !outcomeRows.draw.length || !outcomeRows.away.length) return
    const summary = {}
    ;['home', 'draw', 'away'].forEach(outcome => {
      const prices = outcomeRows[outcome]
      const best = prices.reduce((winner, current) => current.odd > winner.odd ? current : winner, prices[0])
      summary[outcome] = {
        consensus: round(median(prices.map(item => item.odd)), 2),
        best: round(best.odd, 2),
        bookmaker: best.bookmaker,
        books: prices.length
      }
    })
    map.set(fixtureId, summary)
  })
  return map
}

async function fetchApiPrediction(fixtureId) {
  try {
    const payload = await apiFetch(`/predictions?fixture=${encodeURIComponent(fixtureId)}`, 9000)
    return Array.isArray(payload.response) ? payload.response[0] || null : null
  } catch (_) {
    return null
  }
}

async function mapConcurrent(items, limit, mapper) {
  const output = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      output[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return output
}

function predictionPercentages(apiPrediction) {
  const percent = apiPrediction?.predictions?.percent || {}
  const values = [parsePercentage(percent.home), parsePercentage(percent.draw), parsePercentage(percent.away)]
  if (values.some(value => value === null)) return null
  return normalizeThree(values)
}

function marketPercentages(odds) {
  if (!odds?.home?.consensus || !odds?.draw?.consensus || !odds?.away?.consensus) return null
  return normalizeThree([
    1 / odds.home.consensus,
    1 / odds.draw.consensus,
    1 / odds.away.consensus
  ])
}

function buildModelPercentages(odds, apiPrediction) {
  const market = marketPercentages(odds)
  const api = predictionPercentages(apiPrediction)
  if (market && api) return normalizeThree(api.map((value, index) => value * 0.62 + market[index] * 0.38))
  if (api) return api
  if (market) return market
  return null
}

function buildOutcome(key, label, probability, marketOdd) {
  const trueOdd = probability > 0 ? 100 / probability : 0
  const bestOdd = Number(marketOdd?.best || 0)
  const edge = bestOdd > 1 ? probability / 100 * bestOdd - 1 : 0
  return {
    key,
    label,
    probability: round(probability, 1),
    true_odds: round(trueOdd, 2),
    best_odds: round(bestOdd, 2),
    bookmaker: marketOdd?.bookmaker || '',
    edge: round(edge * 100, 2)
  }
}

function buildPredictionRow(fixture, odds, apiPrediction) {
  const fixtureId = String(fixture?.fixture?.id || '')
  const kickoff = fixture?.fixture?.date || ''
  const status = classifyStatus(fixture?.fixture?.status)
  const percentages = buildModelPercentages(odds, apiPrediction)
  if (!fixtureId || !kickoff || !percentages) return null

  const homeName = String(fixture?.teams?.home?.name || 'Gospodarz')
  const awayName = String(fixture?.teams?.away?.name || 'Gość')
  const outcomes = [
    buildOutcome('home', homeName, percentages[0], odds?.home),
    buildOutcome('draw', 'Remis', percentages[1], odds?.draw),
    buildOutcome('away', awayName, percentages[2], odds?.away)
  ]
  const pick = outcomes.reduce((best, outcome) => outcome.probability > best.probability ? outcome : best, outcomes[0])
  const valueBets = outcomes.filter(outcome => outcome.best_odds > 1 && outcome.edge >= 3)
  const predictionInfo = apiPrediction?.predictions || {}
  const comparison = apiPrediction?.comparison || {}
  const teams = apiPrediction?.teams || {}

  return {
    id: fixtureId,
    sport: 'football',
    sport_label: 'Piłka nożna',
    kickoff,
    status,
    status_short: fixture?.fixture?.status?.short || 'NS',
    elapsed: fixture?.fixture?.status?.elapsed ?? null,
    score: {
      home: fixture?.goals?.home ?? null,
      away: fixture?.goals?.away ?? null
    },
    country: fixture?.league?.country || '',
    league: fixture?.league?.name || 'Liga',
    league_logo: fixture?.league?.logo || '',
    round: fixture?.league?.round || '',
    venue: fixture?.fixture?.venue?.name || '',
    home: {
      name: homeName,
      logo: fixture?.teams?.home?.logo || '',
      winner: fixture?.teams?.home?.winner ?? null,
      form: teams?.home?.last_5?.form || null,
      goals_for: teams?.home?.last_5?.goals?.for?.average ?? null,
      goals_against: teams?.home?.last_5?.goals?.against?.average ?? null
    },
    away: {
      name: awayName,
      logo: fixture?.teams?.away?.logo || '',
      winner: fixture?.teams?.away?.winner ?? null,
      form: teams?.away?.last_5?.form || null,
      goals_for: teams?.away?.last_5?.goals?.for?.average ?? null,
      goals_against: teams?.away?.last_5?.goals?.against?.average ?? null
    },
    market: 'Zwycięzca meczu · 1X2',
    outcomes,
    pick_key: pick.key,
    pick_label: pick.label,
    confidence: pick.probability,
    true_odds: pick.true_odds,
    best_odds: pick.best_odds,
    best_bookmaker: pick.bookmaker,
    edge: pick.edge,
    value_bets: valueBets.length,
    model_source: apiPrediction ? (odds ? 'API-Football Prediction + rynek kursów' : 'API-Football Prediction') : 'Rynek kursów bez marży',
    advice: predictionInfo.advice || '',
    under_over: predictionInfo.under_over || '',
    expected_goals: predictionInfo.goals || {},
    winner_comment: predictionInfo?.winner?.comment || '',
    comparison: {
      form_home: parsePercentage(comparison?.form?.home),
      form_away: parsePercentage(comparison?.form?.away),
      attack_home: parsePercentage(comparison?.att?.home),
      attack_away: parsePercentage(comparison?.att?.away),
      defense_home: parsePercentage(comparison?.def?.home),
      defense_away: parsePercentage(comparison?.def?.away),
      poisson_home: parsePercentage(comparison?.poisson_distribution?.home),
      poisson_away: parsePercentage(comparison?.poisson_distribution?.away),
      h2h_home: parsePercentage(comparison?.h2h?.home),
      h2h_away: parsePercentage(comparison?.h2h?.away)
    }
  }
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })
  if (!API_SPORTS_KEY) {
    return json(500, {
      ok: false,
      error: 'Brak APISPORTS_KEY / API_FOOTBALL_KEY w Netlify Environment Variables.'
    }, { 'Cache-Control': 'no-store' })
  }

  const query = event.queryStringParameters || {}
  const hours = clamp(query.hours || 12, 1, 48)
  const limit = Math.floor(clamp(query.limit || 40, 1, 80))
  const deepLimit = Math.floor(clamp(query.deep_limit || process.env.BETAI_PREDICTIONS_DEEP_LIMIT || 12, 0, 30))
  const now = Date.now()
  const end = now + hours * 60 * 60 * 1000
  const errors = []

  try {
    const dates = dateKeysCoveringWindow(hours)
    const fixtureResults = await Promise.allSettled(dates.map(date => fetchFixtures(date)))
    const oddsResults = await Promise.allSettled(dates.map(date => fetchOdds(date)))

    const fixtures = fixtureResults.flatMap((result, index) => {
      if (result.status === 'fulfilled') return result.value
      errors.push(`fixtures ${dates[index]}: ${result.reason?.message || result.reason}`)
      return []
    })
    const oddsRows = oddsResults.flatMap((result, index) => {
      if (result.status === 'fulfilled') return result.value
      errors.push(`odds ${dates[index]}: ${result.reason?.message || result.reason}`)
      return []
    })
    const oddsMap = buildOddsMap(oddsRows)

    const eligible = fixtures
      .filter(row => {
        const kickoff = Date.parse(row?.fixture?.date || '')
        const status = classifyStatus(row?.fixture?.status)
        const live = status === 'live'
        const upcoming = status === 'upcoming' && kickoff >= now - 60 * 1000 && kickoff <= end
        return live || upcoming
      })
      .sort((a, b) => Date.parse(a?.fixture?.date || 0) - Date.parse(b?.fixture?.date || 0))
      .slice(0, Math.max(limit * 2, limit + 10))

    const deepFixtures = eligible.slice(0, deepLimit)
    const deepRows = await mapConcurrent(deepFixtures, 5, fixture => fetchApiPrediction(fixture?.fixture?.id))
    const deepMap = new Map(deepFixtures.map((fixture, index) => [String(fixture?.fixture?.id || ''), deepRows[index]]))

    const predictions = eligible
      .map(fixture => {
        const id = String(fixture?.fixture?.id || '')
        return buildPredictionRow(fixture, oddsMap.get(id), deepMap.get(id) || null)
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1
        if (b.status === 'live' && a.status !== 'live') return 1
        return Date.parse(a.kickoff) - Date.parse(b.kickoff)
      })
      .slice(0, limit)

    const valueBets = predictions.reduce((sum, row) => sum + Number(row.value_bets || 0), 0)
    const liveCount = predictions.filter(row => row.status === 'live').length

    // WERSJA 13: zapisujemy tylko pierwszą, przedmeczową wersję predykcji.
    // Dzięki ignoreDuplicates późniejsze zmiany kursów nie przepisują historii
    // i skuteczność pozostaje uczciwa oraz audytowalna.
    const snapshotResult = await recordPredictionSnapshots(predictions).catch(snapshotError => ({
      ok: false,
      error: snapshotError?.message || String(snapshotError)
    }))
    const stats = await getPredictionStats().catch(statsError => ({
      available: false,
      reason: statsError?.message || String(statsError)
    }))

    return json(200, {
      ok: true,
      generated_at: new Date().toISOString(),
      timezone: TIMEZONE,
      window_hours: hours,
      matches: predictions.length,
      live_matches: liveCount,
      sports_live: predictions.length ? 1 : 0,
      value_bets: valueBets,
      predictions,
      stats,
      diagnostics: {
        fixture_rows: fixtures.length,
        eligible_rows: eligible.length,
        odds_rows: oddsRows.length,
        odds_fixtures: oddsMap.size,
        deep_model_calls: deepFixtures.length,
        history_snapshot: snapshotResult,
        errors: errors.slice(0, 8)
      }
    })
  } catch (error) {
    return json(500, {
      ok: false,
      error: error?.message || 'Nie udało się pobrać predykcji AI.',
      diagnostics: { errors: errors.slice(0, 8) }
    }, { 'Cache-Control': 'no-store' })
  }
}

exports._test = {
  normalizeThree,
  buildModelPercentages,
  buildOddsMap,
  buildPredictionRow,
  parsePercentage
}
