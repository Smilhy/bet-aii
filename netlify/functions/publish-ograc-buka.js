const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY

// WERSJA 1846 — Ograć Buka: selektywny model value oparty wyłącznie na API-Football.
// Funkcja nie obstawia u bukmachera. Publikuje wyłącznie typy i wirtualne stawki na bet-ai.app.
const AUTHOR_NAME = 'Ograć Buka'
const USERNAME = 'ograc-buka'
const VERSION = '1867.2-ograc-buka-balanced-v2'
const SOURCE = 'ograc_buka_api_football_value_v1'

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body, null, 2) }
}
function n(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}
function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(n(value, 0) * factor) / factor
}
function ceilMoney(value) {
  return Math.ceil(n(value, 0) * 100 - 1e-9) / 100
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value, min)))
}
function clean(value, fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}
function normalizeSpace(value = '') {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}
function limitText(value = '', max = 500) {
  const text = normalizeSpace(value)
  if (text.length <= max) return text
  const cut = text.slice(0, Math.max(0, max - 1))
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > Math.floor(max * 0.7) ? cut.slice(0, boundary) : cut).trim()}…`
}
function boolEnv(value, fallback = false) {
  const raw = String(value == null ? '' : value).trim().toLowerCase()
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw)
}
function median(values) {
  const xs = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return 0
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}
function stdev(values) {
  const xs = values.map(Number).filter(Number.isFinite)
  if (xs.length < 2) return 0
  const mean = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const variance = xs.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / xs.length
  return Math.sqrt(variance)
}
function todayWarsaw(offsetDays = 0) {
  const base = new Date()
  base.setUTCDate(base.getUTCDate() + Number(offsetDays || 0))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(base).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function isFutureWithin(iso, minMinutes, maxHours) {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return false
  const delta = ms - Date.now()
  return delta >= Number(minMinutes || 0) * 60 * 1000 && delta <= Number(maxHours || 48) * 60 * 60 * 1000
}
function statusIsPreMatch(short, long) {
  const status = String(short || long || '').toLowerCase()
  return !status || ['ns', 'tbd'].includes(status) || status.includes('not started') || status.includes('scheduled') || status.includes('time to be defined')
}
function normalizeStatus(value = '') {
  const text = String(value || '').toLowerCase().trim()
  if (['won', 'win', 'wygrany'].includes(text)) return 'won'
  if (['lost', 'loss', 'przegrany'].includes(text)) return 'lost'
  if (['void', 'push', 'zwrot'].includes(text)) return 'void'
  return 'pending'
}

async function apiGet(path, query = {}) {
  if (!API_KEY) throw new Error('Missing APISPORTS_KEY / API_FOOTBALL_KEY')
  const url = new URL(`https://v3.football.api-sports.io${path}`)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value))
  })
  const response = await fetch(url.toString(), { headers: { 'x-apisports-key': API_KEY } })
  const text = await response.text()
  let payload = null
  try { payload = JSON.parse(text) } catch { payload = null }
  const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
  if (!response.ok || (errors && Object.keys(errors).length)) {
    const details = errors && Object.keys(errors).length ? JSON.stringify(errors) : text.slice(0, 400)
    throw new Error(`${path} ${response.status}: ${details}`)
  }
  return Array.isArray(payload?.response) ? payload.response : []
}

function normalizeFixture(row) {
  const fixture = row?.fixture || {}
  const teams = row?.teams || {}
  const league = row?.league || {}
  const id = fixture?.id
  const date = fixture?.date
  const home = clean(teams?.home?.name)
  const away = clean(teams?.away?.name)
  if (!id || !date || !home || !away) return null
  if (!statusIsPreMatch(fixture?.status?.short, fixture?.status?.long)) return null
  const iso = new Date(date).toISOString()
  return {
    fixture_id: String(id),
    external_fixture_id: String(id),
    api_fixture_id: String(id),
    match_date: iso.slice(0, 10),
    match_time: iso,
    kickoff_time: iso,
    event_time: iso,
    home,
    away,
    home_team_id: teams?.home?.id ? String(teams.home.id) : null,
    away_team_id: teams?.away?.id ? String(teams.away.id) : null,
    league: clean(league?.name, 'Piłka nożna'),
    league_id: league?.id ? String(league.id) : null,
    country: clean(league?.country),
    sport: 'Piłka nożna',
    sport_key: 'football'
  }
}

function isLowQualityFixture(ev) {
  const text = `${ev.home} ${ev.away} ${ev.league} ${ev.country}`.toLowerCase()
  const blocked = [
    /\bu[- ]?(17|18|19|20|21|22|23)\b/i,
    /\bunder[- ]?(17|18|19|20|21|22|23)\b/i,
    /\byouth\b|\bjunior(s)?\b|\bacadem(y|ia)\b/i,
    /\breserve(s)?\b|\bdevelopment\b/i,
    /\bwomen\b|\bwoman\b|\bfemin(in|ine|ino|ina)\b|\bdames\b|\bfrauen\b/i,
    /\bfriendl(y|ies)\b|\btowarzysk/i,
    /\bamateur\b|\bregional\b/i,
    /\s(ii|iii)\b/i,
    /\s[w]\b/i
  ]
  return blocked.some(pattern => pattern.test(text))
}

async function fetchFixtures(days, minMinutes, maxHours, errors) {
  const all = []
  for (let offset = 0; offset < days; offset++) {
    const date = todayWarsaw(offset)
    try {
      const rows = await apiGet('/fixtures', { date })
      rows.forEach(row => {
        const ev = normalizeFixture(row)
        if (!ev) return
        if (!isFutureWithin(ev.event_time, minMinutes, maxHours)) return
        if (isLowQualityFixture(ev)) return
        all.push(ev)
      })
    } catch (error) {
      errors.push(`fixtures ${date}: ${error.message || error}`)
    }
  }
  const seen = new Set()
  return all.filter(ev => {
    if (seen.has(ev.fixture_id)) return false
    seen.add(ev.fixture_id)
    return true
  }).sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time))
}

function normalizeBetName(name) {
  return clean(name).toLowerCase().replace(/\s+/g, ' ')
}
function normalizeValueName(name) {
  return clean(name).toLowerCase().replace(',', '.').replace(/\s+/g, ' ')
}

// Jedna pozycja API może zawierać kilka linii goli. Zwracamy osobne rynki.
function parseMarkets(betName, values) {
  const bet = normalizeBetName(betName)
  const rows = []

  if (['match winner', 'fulltime result', 'full time result', '1x2', 'result'].includes(bet)) {
    const outcomes = {}
    values.forEach(value => {
      const name = normalizeValueName(value?.value)
      const odd = n(value?.odd, 0)
      if (name === 'home' || name === '1') outcomes.home = odd
      else if (name === 'draw' || name === 'x') outcomes.draw = odd
      else if (name === 'away' || name === '2') outcomes.away = odd
    })
    if (Object.keys(outcomes).length === 3) rows.push({ marketKey: 'match_winner', outcomes })
    return rows
  }

  if (['goals over/under', 'over/under', 'total goals', 'match goals', 'goals'].includes(bet)) {
    const lineMap = new Map()
    values.forEach(value => {
      const name = normalizeValueName(value?.value)
      const odd = n(value?.odd, 0)
      const match = name.match(/^(over|under)\s*(\d+(?:\.\d+)?)$/)
      if (!match) return
      const direction = match[1]
      const line = match[2]
      if (!['1.5', '2.5', '3.5', '4.5'].includes(line)) return
      const key = line.replace('.', '_')
      const outcomes = lineMap.get(line) || {}
      outcomes[`${direction}_${key}`] = odd
      lineMap.set(line, outcomes)
    })
    lineMap.forEach((outcomes, line) => {
      if (Object.keys(outcomes).length === 2) rows.push({ marketKey: `goals_${line.replace('.', '_')}`, outcomes })
    })
  }

  return rows
}

function validOdds(outcomes) {
  const values = Object.values(outcomes)
  return values.length >= 2 && values.every(value => Number.isFinite(value) && value >= 1.01 && value <= 20)
}

function quotesFromOddsRow(row) {
  const groups = []
  for (const bookmaker of Array.isArray(row?.bookmakers) ? row.bookmakers : []) {
    const bookmakerName = clean(bookmaker?.name, 'Bukmacher')
    for (const bet of Array.isArray(bookmaker?.bets) ? bookmaker.bets : []) {
      const parsedRows = parseMarkets(bet?.name, Array.isArray(bet?.values) ? bet.values : [])
      parsedRows.forEach(parsed => {
        if (!parsed || !validOdds(parsed.outcomes)) return
        groups.push({ bookmaker: bookmakerName, ...parsed })
      })
    }
  }
  return groups
}

async function fetchOddsGroups(dates, errors) {
  const map = new Map()
  const maxPages = clamp(process.env.OGRAC_BUKA_ODDS_MAX_PAGES || 8, 1, 20)
  for (const date of dates) {
    let page = 1
    while (page <= maxPages) {
      try {
        const rows = await apiGet('/odds', { date, page })
        rows.forEach(row => {
          const fixtureId = String(row?.fixture?.id || '')
          if (!fixtureId) return
          const groups = quotesFromOddsRow(row)
          if (!groups.length) return
          const existing = map.get(fixtureId) || []
          map.set(fixtureId, existing.concat(groups))
        })
        if (!rows.length) break
        page += 1
      } catch (error) {
        errors.push(`odds ${date} page ${page}: ${error.message || error}`)
        break
      }
    }
  }
  return map
}

function labelForSelection(ev, marketKey, selectionKey) {
  if (marketKey === 'match_winner') {
    if (selectionKey === 'home') return { market: '1X2', prediction: `${ev.home} wygra` }
    if (selectionKey === 'away') return { market: '1X2', prediction: `${ev.away} wygra` }
  }
  if (marketKey === 'goals_1_5' && selectionKey === 'over_1_5') {
    return { market: 'Gole', prediction: 'Powyżej 1.5 gola' }
  }
  if (marketKey === 'goals_2_5' && selectionKey === 'over_2_5') {
    return { market: 'Gole', prediction: 'Powyżej 2.5 gola' }
  }
  if (marketKey === 'goals_3_5' && selectionKey === 'under_3_5') {
    return { market: 'Gole', prediction: 'Poniżej 3.5 gola' }
  }
  if (marketKey === 'goals_4_5' && selectionKey === 'under_4_5') {
    return { market: 'Gole', prediction: 'Poniżej 4.5 gola' }
  }
  return null
}

function allowedSelectionsForMarket(marketKey) {
  if (marketKey === 'match_winner') return ['home', 'away']
  if (marketKey === 'goals_1_5') return ['over_1_5']
  if (marketKey === 'goals_2_5') return ['over_2_5']
  if (marketKey === 'goals_3_5') return ['under_3_5']
  if (marketKey === 'goals_4_5') return ['under_4_5']
  return []
}

function candidateFromMarket(ev, marketKey, groups, settings) {
  const eligibleSelections = allowedSelectionsForMarket(marketKey)
  if (!eligibleSelections.length) return []

  const perBook = []
  groups.forEach(group => {
    const outcomes = group.outcomes || {}
    const inverse = Object.values(outcomes).reduce((sum, odd) => sum + (1 / n(odd, 1)), 0)
    if (!Number.isFinite(inverse) || inverse <= 0) return
    const fair = {}
    Object.entries(outcomes).forEach(([selection, odd]) => {
      fair[selection] = (1 / n(odd, 1)) / inverse
    })
    perBook.push({ bookmaker: group.bookmaker, outcomes, fair })
  })

  if (perBook.length < settings.minBooks) return []

  const candidates = []
  eligibleSelections.forEach(selectionKey => {
    const usable = perBook.filter(item => Number.isFinite(item?.fair?.[selectionKey]) && Number.isFinite(item?.outcomes?.[selectionKey]))
    if (usable.length < settings.minBooks) return

    const fairProbabilities = usable.map(item => item.fair[selectionKey])
    const offeredOdds = usable.map(item => item.outcomes[selectionKey])
    const fairProbability = median(fairProbabilities)
    const probabilitySpread = stdev(fairProbabilities)
    const medianOdds = median(offeredOdds)

    const nonOutlier = usable.filter(item => item.outcomes[selectionKey] <= medianOdds * settings.maxOddsOutlierRatio)
    if (nonOutlier.length < settings.minBooks) return
    const best = nonOutlier.sort((a, b) => b.outcomes[selectionKey] - a.outcomes[selectionKey])[0]
    const bestOdds = n(best?.outcomes?.[selectionKey], 0)
    const expectedValue = fairProbability * bestOdds - 1

    if (bestOdds < settings.minOdds || bestOdds > settings.maxOdds) return
    if (fairProbability < settings.minProbability) return
    if (expectedValue < settings.minEdge) return
    if (probabilitySpread > settings.maxProbabilitySpread) return

    const label = labelForSelection(ev, marketKey, selectionKey)
    if (!label) return

    const edgePct = expectedValue * 100
    const probabilityPct = fairProbability * 100
    const agreementBonus = Math.max(0, 14 - probabilitySpread * 200)
    const booksBonus = Math.min(10, usable.length * 1.1)
    const score = clamp(45 + probabilityPct * 0.55 + edgePct * 1.4 + agreementBonus + booksBonus, 60, 96)

    candidates.push({
      market: label.market,
      prediction: label.prediction,
      market_key: marketKey,
      selection_key: selectionKey,
      odds: round(bestOdds, 2),
      bookmaker: best.bookmaker,
      probability: round(probabilityPct, 1),
      implied: round((1 / bestOdds) * 100, 2),
      ev: round(edgePct, 2),
      ai_score: Math.round(score),
      books_count: usable.length,
      probability_spread: round(probabilitySpread * 100, 2),
      median_market_odds: round(medianOdds, 2),
      synthetic: false
    })
  })

  return candidates
}

function candidatesForEvent(ev, oddsGroups, settings) {
  const groups = oddsGroups.get(String(ev.fixture_id)) || []
  const byMarket = groups.reduce((acc, group) => {
    if (!acc[group.marketKey]) acc[group.marketKey] = []
    acc[group.marketKey].push(group)
    return acc
  }, {})

  return Object.entries(byMarket)
    .flatMap(([marketKey, marketGroups]) => candidateFromMarket(ev, marketKey, marketGroups, settings))
    .map(pick => ({ ev, pick }))
}

function profitFromTip(tip = {}) {
  const status = normalizeStatus(tip.status || tip.result_status || tip.result || tip.settlement_status)
  if (status === 'void' || status === 'pending') return 0
  const explicit = Number(tip.profit)
  if (Number.isFinite(explicit)) return round(explicit, 2)
  const stake = Math.max(0, n(tip.stake ?? tip.amount ?? tip.bet_amount, 1))
  const odds = Math.max(1, n(tip.odds, 1))
  return status === 'won' ? round((odds - 1) * stake, 2) : round(-stake, 2)
}

async function readProgressionState(supabase, targetProfit) {
  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .eq('author_name', AUTHOR_NAME)
    .order('created_at', { ascending: true })
    .limit(1500)
  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const pending = rows.filter(row => normalizeStatus(row.status || row.result_status || row.result || row.settlement_status) === 'pending')

  let cycleNet = 0
  let cycleStep = 0
  let completedCycles = 0
  let totalNet = 0

  rows.forEach(row => {
    const status = normalizeStatus(row.status || row.result_status || row.result || row.settlement_status)
    if (status === 'pending') return
    const profit = profitFromTip(row)
    totalNet = round(totalNet + profit, 2)
    if (status === 'void') return
    cycleStep += 1
    cycleNet = round(cycleNet + profit, 2)
    if (cycleNet >= targetProfit - 0.005) {
      completedCycles += 1
      cycleNet = 0
      cycleStep = 0
    }
  })

  return {
    rows,
    pending,
    cycleNet: round(cycleNet, 2),
    cycleStep,
    completedCycles,
    totalNet: round(totalNet, 2)
  }
}

function progressionForOdds(state, odds, settings) {
  return {
    stake: 1,
    requiredStake: 1,
    capped: false,
    step: 1,
    cycleNetBefore: 0,
    targetProfit: 0,
    possibleProfit: round((odds - 1), 2)
  }
}

async function latestPublishedTip(supabase) {
  const { data, error } = await supabase
    .from('tips')
    .select('id, created_at, status, result_status, result, settlement_status')
    .eq('author_name', AUTHOR_NAME)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length ? data[0] : null
}

function hoursSince(value) {
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? (Date.now() - ms) / 3600000 : Infinity
}

function pct(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace('%', '').replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : fallback
}

function selectedSide(candidate) {
  const key = candidate?.pick?.selection_key
  if (key === 'home') return 'home'
  if (key === 'away') return 'away'
  return ''
}

function predictionPercent(predictions = {}, side = '') {
  if (!side) return 0
  return pct(predictions?.percent?.[side], 0)
}

function winnerMatches(candidate, predictions = {}) {
  const side = selectedSide(candidate)
  if (!side) return false
  const expectedId = side === 'home' ? candidate.ev.home_team_id : candidate.ev.away_team_id
  const winnerId = predictions?.winner?.id == null ? '' : String(predictions.winner.id)
  const winnerName = clean(predictions?.winner?.name).toLowerCase()
  const expectedName = clean(side === 'home' ? candidate.ev.home : candidate.ev.away).toLowerCase()
  return Boolean((expectedId && winnerId === String(expectedId)) || (winnerName && expectedName && winnerName === expectedName))
}

function selectedComparisonAverage(comparison = {}, side = '') {
  if (!side) return 0
  const keys = ['form', 'att', 'def', 'poisson', 'h2h', 'goals', 'total']
  const values = keys.map(key => pct(comparison?.[key]?.[side], NaN)).filter(Number.isFinite)
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function normalizeGoalAdvice(value = '') {
  return String(value || '').toLowerCase().replace(',', '.').replace(/\s+/g, ' ').trim()
}

function goalPredictionMatches(candidate, predictions = {}) {
  const predicted = normalizeGoalAdvice(predictions?.under_over || predictions?.advice)
  const key = String(candidate?.pick?.selection_key || '')
  const match = key.match(/^(over|under)_(\d)_(\d)$/)
  if (!match) return false
  const direction = match[1]
  const line = `${match[2]}.${match[3]}`
  const aliases = direction === 'over' ? ['over', 'powyżej', '+'] : ['under', 'poniżej', '-']
  return aliases.some(alias => predicted.includes(`${alias} ${line}`) || predicted.includes(`${alias}${line}`))
}

function injuriesByFixture(rows = []) {
  const map = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach(row => {
    const fixtureId = String(row?.fixture?.id || '')
    const teamId = String(row?.team?.id || '')
    if (!fixtureId || !teamId) return
    const item = map.get(fixtureId) || new Map()
    item.set(teamId, (item.get(teamId) || 0) + 1)
    map.set(fixtureId, item)
  })
  return map
}

function buildApiEvidence(candidate, predictionRow, injuryMap, settings) {
  const predictions = predictionRow?.predictions || {}
  const comparison = predictionRow?.comparison || {}
  const side = selectedSide(candidate)
  const marketScore = clamp(candidate.pick.ai_score, 0, 100)
  let apiScore = 0
  let apiProbability = 0
  let supported = false
  let contrary = false
  let comparisonPct = 0
  let reason = ''

  if (side) {
    apiProbability = predictionPercent(predictions, side)
    const winnerOk = winnerMatches(candidate, predictions)
    comparisonPct = selectedComparisonAverage(comparison, side)
    supported = winnerOk && apiProbability >= settings.minApiProbability
    contrary = Boolean(predictions?.winner?.id || predictions?.winner?.name) && !winnerOk
    apiScore = clamp(
      apiProbability * 0.72 +
      comparisonPct * 0.18 +
      (winnerOk ? 13 : -12) +
      (predictions?.win_or_draw ? 2 : 0),
      0,
      100
    )
    reason = winnerOk
      ? `API-Football wskazuje ${candidate.pick.prediction} z prawdopodobieństwem ${round(apiProbability, 1)}%.`
      : `Prognoza API-Football nie potwierdza jednoznacznie wyboru ${candidate.pick.prediction}.`
  } else {
    const goalsOk = goalPredictionMatches(candidate, predictions)
    supported = goalsOk
    contrary = Boolean(predictions?.under_over) && !goalsOk
    apiScore = goalsOk ? 72 : 28
    reason = goalsOk
      ? `Prognoza goli API-Football potwierdza wybór ${candidate.pick.prediction}.`
      : `Prognoza goli API-Football nie potwierdza wyboru ${candidate.pick.prediction}.`
  }

  const fixtureInjuries = injuryMap.get(String(candidate.ev.fixture_id)) || new Map()
  const homeInjuries = fixtureInjuries.get(String(candidate.ev.home_team_id || '')) || 0
  const awayInjuries = fixtureInjuries.get(String(candidate.ev.away_team_id || '')) || 0
  let injuryAdjustment = 0
  if (side === 'home') injuryAdjustment = clamp(awayInjuries - homeInjuries, -4, 4)
  if (side === 'away') injuryAdjustment = clamp(homeInjuries - awayInjuries, -4, 4)
  apiScore = clamp(apiScore + injuryAdjustment, 0, 100)

  const combinedScore = round(marketScore * settings.marketWeight + apiScore * settings.apiWeight, 2)
  const marketProbability = n(candidate?.pick?.probability, 0)
  const conservativeProbability = side
    ? Math.max(0, Math.min(marketProbability, apiProbability || marketProbability) - 1.5)
    : Math.max(0, marketProbability - 2)
  const conservativeEdge = (conservativeProbability / 100) * n(candidate?.pick?.odds, 0) - 1
  const comparisonOk = !side || comparisonPct >= settings.minComparison
  const accepted = Boolean(
    supported &&
    !contrary &&
    comparisonOk &&
    conservativeEdge >= settings.minConservativeEdge &&
    apiScore >= settings.minApiScore &&
    combinedScore >= settings.minCombinedScore
  )

  const evidenceParts = [reason]
  if (comparisonPct > 0) evidenceParts.push(`Porównanie formy, ataku, obrony i H2H daje wybranej stronie średnio ${round(comparisonPct, 1)}%.`)
  if (homeInjuries || awayInjuries) evidenceParts.push(`Zgłoszone absencje: ${candidate.ev.home} ${homeInjuries}, ${candidate.ev.away} ${awayInjuries}.`)
  evidenceParts.push(`Kurs ${candidate.pick.odds} u ${candidate.pick.bookmaker}; konsensus rynku ${candidate.pick.probability}% z ${candidate.pick.books_count} bukmacherów.`)

  return {
    supported,
    contrary,
    accepted,
    apiScore: round(apiScore, 2),
    combinedScore,
    apiProbability: round(apiProbability, 1),
    comparisonPct: round(comparisonPct, 1),
    conservativeProbability: round(conservativeProbability, 1),
    conservativeEdge: round(conservativeEdge * 100, 2),
    comparisonOk,
    predictedWinner: clean(predictions?.winner?.name),
    winOrDraw: Boolean(predictions?.win_or_draw),
    underOver: clean(predictions?.under_over),
    advice: limitText(predictions?.advice || '', 160),
    homeInjuries,
    awayInjuries,
    analysis: limitText(evidenceParts.join(' '), 460)
  }
}

async function fetchApiFootballEvidence(candidates, settings, errors) {
  if (!candidates.length) return []
  const predictionRows = new Map()

  for (const candidate of candidates) {
    try {
      const rows = await apiGet('/predictions', { fixture: candidate.ev.fixture_id })
      predictionRows.set(String(candidate.ev.fixture_id), rows[0] || null)
    } catch (error) {
      errors.push(`predictions ${candidate.ev.fixture_id}: ${error.message || error}`)
      predictionRows.set(String(candidate.ev.fixture_id), null)
    }
  }

  let injuryRows = []
  if (settings.useInjuries) {
    try {
      const ids = [...new Set(candidates.map(candidate => candidate.ev.fixture_id))].slice(0, 20).join('-')
      if (ids) injuryRows = await apiGet('/injuries', { ids })
    } catch (error) {
      errors.push(`injuries: ${error.message || error}`)
    }
  }
  const injuryMap = injuriesByFixture(injuryRows)

  return candidates.map(candidate => {
    const row = predictionRows.get(String(candidate.ev.fixture_id))
    if (!row) {
      return {
        supported: false,
        contrary: false,
        accepted: false,
        apiScore: 0,
        combinedScore: round(candidate.pick.ai_score * settings.marketWeight, 2),
        apiProbability: 0,
        comparisonPct: 0,
        conservativeProbability: 0,
        conservativeEdge: 0,
        comparisonOk: false,
        predictedWinner: '',
        winOrDraw: false,
        underOver: '',
        advice: '',
        homeInjuries: 0,
        awayInjuries: 0,
        analysis: 'API-Football nie zwróciło prognozy dla tego spotkania, dlatego typ nie został zaakceptowany.'
      }
    }
    return buildApiEvidence(candidate, row, injuryMap, settings)
  })
}

function buildTipRow(ev, pick, progression, apiEvidence = null, combinedScore = null) {
  const now = new Date().toISOString()
  return {
    ai_external_key: `${SOURCE}|${ev.fixture_id}|${pick.market_key}|${pick.selection_key}`,
    external_fixture_id: ev.external_fixture_id,
    api_fixture_id: ev.api_fixture_id,
    fixture_id: ev.fixture_id,

    author_name: AUTHOR_NAME,
    username: USERNAME,
    public_slug: USERNAME,
    user_id: null,

    sport: ev.sport,
    sport_key: ev.sport_key,
    country: ev.country,
    league: ev.league,
    league_id: ev.league_id,
    match_name: `${ev.home} vs ${ev.away}`,
    match: `${ev.home} vs ${ev.away}`,
    team_home: ev.home,
    team_away: ev.away,
    match_date: ev.match_date,
    match_time: ev.match_time,
    event_time: ev.event_time,
    kickoff_time: ev.kickoff_time,

    market: pick.market,
    bet_type: pick.prediction,
    prediction: pick.prediction,
    pick: pick.prediction,
    selection: pick.prediction,
    market_key: pick.market_key,
    selection_key: pick.selection_key,

    odds: pick.odds,
    bookmaker: pick.bookmaker,
    odds_bookmaker: pick.bookmaker,
    stake: progression.stake,
    status: 'pending',
    result: null,
    settlement_status: 'pending',
    result_status: null,
    profit: 0,
    payout: 0,
    return_amount: 0,

    is_premium: false,
    access_type: 'free',
    coupon_type: 'single',
    is_ako: false,
    legs_count: 1,

    source: SOURCE,
    tip_source: SOURCE,
    ai_source: VERSION,
    ai_model_version: VERSION,
    ai_score: Math.round(combinedScore == null ? pick.ai_score : combinedScore),
    ai_confidence: Math.round(combinedScore == null ? pick.ai_score : combinedScore),
    probability: Math.round(pick.probability),
    model_probability: Math.round(apiEvidence?.conservativeProbability || pick.probability),
    implied_probability: round(pick.implied, 2),
    value_score: round(apiEvidence?.conservativeEdge ?? pick.ev, 2),
    ev: round(apiEvidence?.conservativeEdge ?? pick.ev, 2),
    quality_label: 'OGRAĆ BUKA — API-FOOTBALL VALUE',
    tags: ['ograc-buka', 'flat-stake', 'value-betting', 'api-football', 'predictions', 'injuries'],
    api_prediction_score: apiEvidence ? round(apiEvidence.apiScore, 2) : null,
    api_prediction_probability: apiEvidence ? round(apiEvidence.apiProbability, 1) : null,
    api_prediction_winner: apiEvidence?.predictedWinner || '',
    api_prediction_under_over: apiEvidence?.underOver || '',
    api_prediction_advice: apiEvidence?.advice || '',
    api_home_injuries: apiEvidence ? Math.round(n(apiEvidence.homeInjuries, 0)) : 0,
    api_away_injuries: apiEvidence ? Math.round(n(apiEvidence.awayInjuries, 0)) : 0,
    analysis: limitText([
      apiEvidence?.analysis || `API-Football i konsensus rynku wskazują przewagę dla wyboru: ${pick.prediction}.`,
      apiEvidence?.conservativeProbability ? `Konserwatywne prawdopodobieństwo: ${apiEvidence.conservativeProbability}%, szacowane value: ${apiEvidence.conservativeEdge}%.` : '',
      'Stała wirtualna stawka 1 jednostki; bez progresji i bez gonienia strat. Brak gwarancji wyniku.'
    ].filter(Boolean).join(' '), 500),

    created_at: now,
    updated_at: now
  }
}

function missingColumn(error) {
  const message = String(error?.message || error || '')
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match ? match[1] : ''
}
function forceIntegerColumns(row) {
  const out = { ...row }
  ;['ai_score', 'ai_confidence', 'probability', 'model_probability'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = Math.round(n(out[key], 0))
  })
  return out
}
async function insertSafe(supabase, row) {
  const removed = []
  const payload = forceIntegerColumns(row)
  for (let attempt = 0; attempt < 45; attempt++) {
    const { data, error } = await supabase.from('tips').insert(payload).select('id').single()
    if (!error) return { data, removed }
    const column = missingColumn(error)
    if (column && Object.prototype.hasOwnProperty.call(payload, column)) {
      delete payload[column]
      removed.push(column)
      continue
    }
    throw error
  }
  throw new Error(`Too many missing-column retries: ${removed.join(', ')}`)
}

async function fixtureAlreadyUsed(supabase, fixtureId) {
  const { data, error } = await supabase
    .from('tips')
    .select('id')
    .eq('author_name', AUTHOR_NAME)
    .eq('fixture_id', String(fixtureId))
    .limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

// Skan co 3 godziny. Publikacja jest selektywna: maksymalnie jeden aktywny typ
// i jeden nowy typ w okresie cooldown. Stawka zawsze wynosi 1 jednostkę.
exports.config = { schedule: '0 */3 * * *' }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing SUPABASE_URL or SERVICE ROLE KEY' })
  if (!API_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing APISPORTS_KEY / API_FOOTBALL_KEY' })

  const q = event.queryStringParameters || {}
  const dryRun = ['1', 'true', 'yes'].includes(String(q.dry_run || '').toLowerCase())
  const force = ['1', 'true', 'yes'].includes(String(q.force || '').toLowerCase())
  const days = clamp(q.days || process.env.OGRAC_BUKA_LOOKAHEAD_DAYS || 2, 1, 3)
  const minMinutes = clamp(q.min_minutes_before_start || process.env.OGRAC_BUKA_MIN_MINUTES_BEFORE_START || 75, 45, 720)
  const maxHours = clamp(q.max_hours_ahead || process.env.OGRAC_BUKA_MAX_HOURS_AHEAD || 48, 6, 72)

  const settings = {
    minBooks: clamp(q.min_books || process.env.OGRAC_BUKA_MIN_BOOKS || 2, 2, 15),
    minOdds: clamp(q.min_odds || process.env.OGRAC_BUKA_MIN_ODDS || 1.50, 1.2, 5),
    maxOdds: clamp(q.max_odds || process.env.OGRAC_BUKA_MAX_ODDS || 5.00, 1.5, 5),
    minProbability: clamp(q.min_probability || process.env.OGRAC_BUKA_MIN_PROBABILITY || 0.52, 0.45, 0.85),
    minEdge: clamp(q.min_edge || process.env.OGRAC_BUKA_MIN_EDGE || 0.01, 0, 0.2),
    maxProbabilitySpread: clamp(q.max_probability_spread || process.env.OGRAC_BUKA_MAX_PROBABILITY_SPREAD || 0.065, 0.01, 0.15),
    maxOddsOutlierRatio: clamp(q.max_odds_outlier_ratio || process.env.OGRAC_BUKA_MAX_ODDS_OUTLIER_RATIO || 1.10, 1.01, 1.2),
    baseStake: 1,
    maxStake: 1,
    targetProfit: 0,
    apiCandidates: clamp(q.api_candidates || process.env.OGRAC_BUKA_API_CANDIDATES || 8, 1, 8),
    minApiScore: clamp(q.min_api_score || process.env.OGRAC_BUKA_MIN_API_SCORE || 54, 40, 95),
    minApiProbability: clamp(q.min_api_probability || process.env.OGRAC_BUKA_MIN_API_PROBABILITY || 51, 40, 85),
    minCombinedScore: clamp(q.min_combined_score || process.env.OGRAC_BUKA_MIN_COMBINED_SCORE || 58, 40, 95),
    apiWeight: clamp(q.api_weight || process.env.OGRAC_BUKA_API_WEIGHT || 0.60, 0.2, 0.8),
    marketWeight: 0,
    requireApiPrediction: boolEnv(q.require_api_prediction ?? process.env.OGRAC_BUKA_REQUIRE_API_PREDICTION, true),
    useInjuries: boolEnv(q.use_injuries ?? process.env.OGRAC_BUKA_USE_INJURIES, true),
    minComparison: clamp(q.min_comparison || process.env.OGRAC_BUKA_MIN_COMPARISON || 48, 40, 80),
    minConservativeEdge: clamp(q.min_conservative_edge || process.env.OGRAC_BUKA_MIN_CONSERVATIVE_EDGE || 0.015, 0, 0.15),
    cooldownHours: clamp(q.cooldown_hours || process.env.OGRAC_BUKA_COOLDOWN_HOURS || 10, 6, 72)
  }
  settings.marketWeight = round(1 - settings.apiWeight, 4)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const errors = []

  let progressionState
  try {
    progressionState = await readProgressionState(supabase, settings.targetProfit)
  } catch (error) {
    return json(500, { ok: false, version: VERSION, error: `Progression state failed: ${error.message || error}` })
  }

  if (!dryRun && progressionState.pending.length > 0) {
    return json(200, {
      ok: true,
      version: VERSION,
      author: AUTHOR_NAME,
      inserted: 0,
      skipped: 'previous_pick_pending',
      pending: progressionState.pending.length,
      message: 'Poprzedni typ Ograć Buka nie jest jeszcze rozliczony. Silnik nie publikuje kilku aktywnych typów jednocześnie.'
    })
  }

  if (!dryRun && !force) {
    try {
      const latest = await latestPublishedTip(supabase)
      if (latest && hoursSince(latest.created_at) < settings.cooldownHours) {
        return json(200, {
          ok: true,
          version: VERSION,
          author: AUTHOR_NAME,
          inserted: 0,
          skipped: 'cooldown',
          cooldown_hours: settings.cooldownHours,
          hours_since_last_pick: round(hoursSince(latest.created_at), 2),
          message: 'Ograć Buka publikuje maksymalnie jeden selektywny typ w okresie cooldown.'
        })
      }
    } catch (error) {
      errors.push(`cooldown: ${error.message || error}`)
    }
  }

  const fixtures = await fetchFixtures(days, minMinutes, maxHours, errors)
  const dates = [...new Set(fixtures.map(item => item.match_date).filter(Boolean))]
  const oddsGroups = await fetchOddsGroups(dates, errors)

  const allCandidates = fixtures
    .flatMap(ev => candidatesForEvent(ev, oddsGroups, settings))
    .sort((a, b) => {
      const probabilityDiff = n(b.pick.probability) - n(a.pick.probability)
      if (probabilityDiff) return probabilityDiff
      const edgeDiff = n(b.pick.ev) - n(a.pick.ev)
      if (edgeDiff) return edgeDiff
      const booksDiff = n(b.pick.books_count) - n(a.pick.books_count)
      if (booksDiff) return booksDiff
      return Date.parse(a.ev.event_time) - Date.parse(b.ev.event_time)
    })

  const uniqueFixtures = []
  const seenFixtures = new Set()
  for (const candidate of allCandidates) {
    if (seenFixtures.has(candidate.ev.fixture_id)) continue
    seenFixtures.add(candidate.ev.fixture_id)
    const progression = progressionForOdds(progressionState, candidate.pick.odds, settings)
    uniqueFixtures.push({ ...candidate, progression })
  }

  const apiPool = uniqueFixtures.slice(0, settings.apiCandidates)
  const apiResults = await fetchApiFootballEvidence(apiPool, settings, errors)
  const apiCandidates = apiPool
    .map((candidate, index) => ({ ...candidate, apiEvidence: apiResults[index], combinedScore: apiResults[index]?.combinedScore || 0 }))
    .filter(candidate => !settings.requireApiPrediction || candidate.apiEvidence?.accepted)
    .sort((a, b) => {
      if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore
      if (n(b.apiEvidence?.apiScore) !== n(a.apiEvidence?.apiScore)) return n(b.apiEvidence?.apiScore) - n(a.apiEvidence?.apiScore)
      return n(b.pick.probability) - n(a.pick.probability)
    })

  if (dryRun) {
    return json(200, {
      ok: true,
      dry_run: true,
      version: VERSION,
      author: AUTHOR_NAME,
      strategy: 'API-Football value model: market consensus + predictions + comparison + injuries + flat stake 1',
      fixtures_found: fixtures.length,
      odds_fixtures_found: oddsGroups.size,
      market_candidates_found: uniqueFixtures.length,
      api_candidates_checked: apiPool.length,
      accepted_after_api: apiCandidates.length,
      performance_state: {
        pending: progressionState.pending.length,
        cycle_net: progressionState.cycleNet,
        next_step: progressionState.cycleStep + 1,
        completed_cycles: progressionState.completedCycles,
        total_net: progressionState.totalNet
      },
      candidates: apiPool.map((candidate, index) => ({
        accepted: Boolean(apiResults[index]?.accepted),
        combined_score: apiResults[index]?.combinedScore || 0,
        api_football: apiResults[index],
        tip: buildTipRow(candidate.ev, candidate.pick, candidate.progression, apiResults[index], apiResults[index]?.combinedScore)
      })),
      settings,
      errors: errors.slice(0, 25)
    })
  }

  let selected = null
  for (const candidate of apiCandidates) {
    try {
      if (force || !(await fixtureAlreadyUsed(supabase, candidate.ev.fixture_id))) {
        selected = candidate
        break
      }
    } catch (error) {
      errors.push(`duplicate check ${candidate.ev.fixture_id}: ${error.message || error}`)
    }
  }

  if (!selected) {
    return json(200, {
      ok: true,
      version: VERSION,
      author: AUTHOR_NAME,
      inserted: 0,
      fixtures_found: fixtures.length,
      odds_fixtures_found: oddsGroups.size,
      market_candidates_found: uniqueFixtures.length,
      api_candidates_checked: apiPool.length,
      candidates_found: apiCandidates.length,
      message: settings.requireApiPrediction
        ? 'Brak typu potwierdzonego przez prognozy API-Football i rynek kursowy. Silnik nie publikuje wyboru na siłę.'
        : 'Brak typu spełniającego rygorystyczne filtry Ograć Buka. Silnik nie publikuje wyboru na siłę.',
      performance_state: {
        cycle_net: progressionState.cycleNet,
        next_step: progressionState.cycleStep + 1,
        completed_cycles: progressionState.completedCycles,
        total_net: progressionState.totalNet
      },
      settings,
      errors: errors.slice(0, 25)
    })
  }

  const row = buildTipRow(selected.ev, selected.pick, selected.progression, selected.apiEvidence, selected.combinedScore)
  try {
    const out = await insertSafe(supabase, row)
    try {
      await supabase.from('ai_pick_runs').insert({
        source: VERSION,
        picks_created: 1,
        status: 'success',
        error_message: errors.length ? errors.slice(0, 8).join(' | ').slice(0, 1000) : null,
        finished_at: new Date().toISOString()
      })
    } catch (_) {}

    return json(200, {
      ok: true,
      version: VERSION,
      author: AUTHOR_NAME,
      inserted: 1,
      id: out.data?.id,
      removed_columns: out.removed,
      strategy: 'API-Football value model: market consensus + predictions + comparison + injuries + flat stake 1',
      staking: { method: 'flat', stake: 1 },
      pick: row,
      settings,
      errors: errors.slice(0, 25)
    })
  } catch (error) {
    return json(500, {
      ok: false,
      version: VERSION,
      author: AUTHOR_NAME,
      inserted: 0,
      error: error.message || String(error),
      candidate: row,
      errors: errors.slice(0, 25)
    })
  }
}
