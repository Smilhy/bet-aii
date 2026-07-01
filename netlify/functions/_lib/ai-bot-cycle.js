const { createClient } = require('@supabase/supabase-js')

const AUTHORS = {
  betai: { name: 'BetAI MultiSport AI', username: 'betai-multisport-ai', source: 'betai_independent_value_v1867_6', mirrorAiBets: true },
  typer: { name: 'Typer Expert', username: 'typer-expert', source: 'typer_expert_independent_v1867_6', mirrorAiBets: false },
  ograc: { name: 'Ograć Buka', username: 'ograc-buka', source: 'ograc_buka_independent_v1867_6', mirrorAiBets: false }
}

const VERSION = '1867.6-three-independent-strategies-v1'
const DEFAULT_BOTS = ['betai', 'typer', 'ograc']

// Wspólne jest wyłącznie pobranie surowych meczów i kursów.
// Każdy profil ma własną strategię, progi, ranking i cooldown.
const BOT_POLICIES = {
  betai: {
    strategyName: 'Szeroki silnik value',
    cooldownHours: 4,
    minOdds: 1.50,
    maxOdds: 5.00,
    minBooks: 2,
    minProbability: 18,
    minEdge: 0.5,
    maxSpread: 10,
    fallback: { minBooks: 1, minProbability: 15, minEdge: -1.0, maxSpread: 14 },
    allowedMarkets: ['match_winner', 'goals_2_5', 'btts'],
    allowedSelections: ['home', 'away', 'over_2_5', 'yes'],
    predictionLookups: 0
  },
  typer: {
    strategyName: 'Rynek + prognoza API-Football',
    cooldownHours: 8,
    minOdds: 1.50,
    maxOdds: 5.00,
    minBooks: 2,
    minProbability: 27,
    minEdge: -0.5,
    maxSpread: 8,
    fallback: { minBooks: 2, minProbability: 23, minEdge: -1.5, maxSpread: 10 },
    allowedMarkets: ['match_winner', 'goals_2_5', 'btts'],
    allowedSelections: ['home', 'away', 'over_2_5', 'under_2_5', 'yes', 'no'],
    predictionLookups: 4
  },
  ograc: {
    strategyName: 'Selektywny API value bez progresji',
    cooldownHours: 6,
    minOdds: 1.80,
    maxOdds: 5.00,
    minBooks: 2,
    minProbability: 18,
    minEdge: 1.0,
    maxSpread: 7.5,
    fallback: { minBooks: 2, minProbability: 18, minEdge: 0.5, maxSpread: 9.5 },
    allowedMarkets: ['match_winner', 'goals_2_5', 'btts'],
    allowedSelections: ['home', 'away', 'over_2_5', 'yes'],
    predictionLookups: 4
  }
}

function number(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, number(value, min))) }
function round(value, digits = 2) {
  const f = 10 ** digits
  return Math.round(number(value, 0) * f) / f
}
function clean(value, fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}
function median(values = []) {
  const xs = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return 0
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}
function stdev(values = []) {
  const xs = values.map(Number).filter(Number.isFinite)
  if (xs.length < 2) return 0
  const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length
  return Math.sqrt(xs.reduce((sum, x) => sum + ((x - mean) ** 2), 0) / xs.length)
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body, null, 2)
  }
}
function todayWarsaw(offsetDays = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + Number(offsetDays || 0))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function futureWithin(iso, minMinutes, maxHours) {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return false
  const delta = ts - Date.now()
  return delta >= minMinutes * 60_000 && delta <= maxHours * 3_600_000
}
function isPreMatch(row = {}) {
  const status = String(row?.fixture?.status?.short || row?.fixture?.status?.long || '').toLowerCase()
  return !status || ['ns', 'tbd'].includes(status) || status.includes('not started') || status.includes('scheduled')
}
function isLowQuality(event = {}) {
  const text = `${event.home} ${event.away} ${event.league}`.toLowerCase()
  return [
    /\bu[- ]?(17|18|19|20|21|22|23)\b/i,
    /\bunder[- ]?(17|18|19|20|21|22|23)\b/i,
    /\byouth\b|\bjunior(s)?\b|\bacadem(y|ia)\b/i,
    /\breserve(s)?\b|\bdevelopment\b/i,
    /\bwomen\b|\bwoman\b|\bfrauen\b|\bdames\b/i,
    /\bfriendl(y|ies)\b|\btowarzysk/i
  ].some(pattern => pattern.test(text))
}

function getEnvironment() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
    apiKey: process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
  }
}

async function apiGet(path, query, context) {
  const url = new URL(`https://v3.football.api-sports.io${path}`)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value))
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7500)
  const started = Date.now()
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'x-apisports-key': context.apiKey }
    })
    const text = await response.text()
    let payload = null
    try { payload = JSON.parse(text) } catch (_) { payload = null }
    context.apiCalls += 1
    const remaining = response.headers.get('x-ratelimit-requests-remaining') || response.headers.get('x-ratelimit-remaining')
    if (remaining !== null) context.apiRemaining = Number(remaining)
    context.apiDurations.push({ path, ms: Date.now() - started, status: response.status })
    const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
    if (!response.ok || (errors && Object.keys(errors).length)) {
      const details = errors && Object.keys(errors).length ? JSON.stringify(errors) : text.slice(0, 400)
      throw new Error(`${path} HTTP ${response.status}: ${details}`)
    }
    return Array.isArray(payload?.response) ? payload.response : []
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeFixture(row) {
  if (!row || !isPreMatch(row)) return null
  const fixture = row.fixture || {}
  const teams = row.teams || {}
  const league = row.league || {}
  const id = fixture.id
  const date = fixture.date
  const home = clean(teams?.home?.name)
  const away = clean(teams?.away?.name)
  if (!id || !date || !home || !away) return null
  const iso = new Date(date).toISOString()
  return {
    fixtureId: String(id),
    home,
    away,
    homeId: teams?.home?.id ? String(teams.home.id) : '',
    awayId: teams?.away?.id ? String(teams.away.id) : '',
    league: clean(league?.name, 'Piłka nożna'),
    leagueId: league?.id ? String(league.id) : '',
    country: clean(league?.country, 'API-Football'),
    kickoff: iso,
    matchDate: iso.slice(0, 10)
  }
}

async function fetchFixtures(context, settings, dates) {
  const results = await Promise.allSettled(dates.map(date => apiGet('/fixtures', { date }, context)))
  const events = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      context.errors.push(`fixtures ${dates[index]}: ${result.reason?.message || result.reason}`)
      return
    }
    ;(result.value || []).forEach(row => {
      const event = normalizeFixture(row)
      if (!event) return
      if (!futureWithin(event.kickoff, settings.minMinutes, settings.maxHours)) return
      if (isLowQuality(event)) return
      events.push(event)
    })
  })
  const unique = new Map()
  events.forEach(event => unique.set(event.fixtureId, event))
  return [...unique.values()].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
}

function normalizeName(value) { return clean(value).toLowerCase().replace(',', '.').replace(/\s+/g, ' ') }
function parseMarket(betName, values = []) {
  const bet = normalizeName(betName)
  const outcomes = {}
  if (['match winner', 'fulltime result', 'full time result', '1x2', 'result'].includes(bet)) {
    values.forEach(value => {
      const name = normalizeName(value?.value)
      const odd = number(value?.odd, 0)
      if (name === 'home' || name === '1') outcomes.home = odd
      else if (name === 'draw' || name === 'x') outcomes.draw = odd
      else if (name === 'away' || name === '2') outcomes.away = odd
    })
    return Object.keys(outcomes).length === 3 ? { marketKey: 'match_winner', outcomes } : null
  }
  if (['goals over/under', 'over/under', 'total goals', 'match goals', 'goals'].includes(bet)) {
    values.forEach(value => {
      const name = normalizeName(value?.value)
      const odd = number(value?.odd, 0)
      if (/^over\s*2\.5$/.test(name)) outcomes.over_2_5 = odd
      else if (/^under\s*2\.5$/.test(name)) outcomes.under_2_5 = odd
    })
    return Object.keys(outcomes).length === 2 ? { marketKey: 'goals_2_5', outcomes } : null
  }
  if (['both teams score', 'both teams to score', 'btts'].includes(bet)) {
    values.forEach(value => {
      const name = normalizeName(value?.value)
      const odd = number(value?.odd, 0)
      if (name === 'yes') outcomes.yes = odd
      else if (name === 'no') outcomes.no = odd
    })
    return Object.keys(outcomes).length === 2 ? { marketKey: 'btts', outcomes } : null
  }
  return null
}
function oddsGroupsFromRow(row) {
  const groups = []
  ;(Array.isArray(row?.bookmakers) ? row.bookmakers : []).forEach(bookmaker => {
    const bookmakerName = clean(bookmaker?.name, 'Bukmacher')
    ;(Array.isArray(bookmaker?.bets) ? bookmaker.bets : []).forEach(bet => {
      const parsed = parseMarket(bet?.name, Array.isArray(bet?.values) ? bet.values : [])
      if (!parsed) return
      const values = Object.values(parsed.outcomes)
      if (!values.length || values.some(value => !Number.isFinite(value) || value < 1.01 || value > 25)) return
      groups.push({ bookmaker: bookmakerName, ...parsed })
    })
  })
  return groups
}
async function fetchOdds(context, dates) {
  const maxPages = Math.round(clamp(process.env.AI_BOTS_ODDS_MAX_PAGES || 2, 1, 3))
  const requests = dates.flatMap(date => Array.from({ length: maxPages }, (_, index) => ({ date, page: index + 1 })))
  const results = await Promise.allSettled(requests.map(request => apiGet('/odds', request, context)))
  const map = new Map()
  results.forEach((result, index) => {
    const request = requests[index]
    if (result.status === 'rejected') {
      context.errors.push(`odds ${request.date} page ${request.page}: ${result.reason?.message || result.reason}`)
      return
    }
    ;(result.value || []).forEach(row => {
      const fixtureId = String(row?.fixture?.id || '')
      if (!fixtureId) return
      const groups = oddsGroupsFromRow(row)
      if (!groups.length) return
      map.set(fixtureId, (map.get(fixtureId) || []).concat(groups))
    })
  })
  return map
}

function labelFor(event, marketKey, selectionKey) {
  if (marketKey === 'match_winner') {
    if (selectionKey === 'home') return { market: '1X2', prediction: `${event.home} wygra` }
    if (selectionKey === 'draw') return { market: '1X2', prediction: 'Remis' }
    if (selectionKey === 'away') return { market: '1X2', prediction: `${event.away} wygra` }
  }
  if (marketKey === 'goals_2_5') {
    if (selectionKey === 'over_2_5') return { market: 'Gole', prediction: 'Powyżej 2.5 gola' }
    if (selectionKey === 'under_2_5') return { market: 'Gole', prediction: 'Poniżej 2.5 gola' }
  }
  if (marketKey === 'btts') {
    if (selectionKey === 'yes') return { market: 'BTTS', prediction: 'Obie drużyny strzelą: TAK' }
    if (selectionKey === 'no') return { market: 'BTTS', prediction: 'Obie drużyny strzelą: NIE' }
  }
  return null
}
function buildCandidates(events, oddsMap, settings) {
  const candidates = []
  events.forEach(event => {
    const groups = oddsMap.get(event.fixtureId) || []
    const byMarket = groups.reduce((acc, group) => {
      if (!acc[group.marketKey]) acc[group.marketKey] = []
      acc[group.marketKey].push(group)
      return acc
    }, {})
    Object.entries(byMarket).forEach(([marketKey, marketGroups]) => {
      const selections = [...new Set(marketGroups.flatMap(group => Object.keys(group.outcomes || {})))]
      selections.forEach(selectionKey => {
        const perBook = marketGroups.map(group => {
          const entries = Object.entries(group.outcomes || {}).filter(([, odd]) => number(odd, 0) > 1)
          const overround = entries.reduce((sum, [, odd]) => sum + (1 / number(odd, 1)), 0)
          const selectedOdd = number(group.outcomes?.[selectionKey], 0)
          if (!selectedOdd || !overround) return null
          return { bookmaker: group.bookmaker, odd: selectedOdd, fair: (1 / selectedOdd) / overround }
        }).filter(Boolean)
        if (perBook.length < settings.minBooks) return
        const fairProbability = median(perBook.map(item => item.fair))
        const spread = stdev(perBook.map(item => item.fair))
        const medianOdd = median(perBook.map(item => item.odd))
        const nonOutliers = perBook.filter(item => perBook.length === 1 || item.odd <= medianOdd * 1.22)
        if (!nonOutliers.length) return
        const best = [...nonOutliers].sort((a, b) => b.odd - a.odd)[0]
        if (best.odd < settings.minOdds || best.odd > settings.maxOdds) return
        if (fairProbability < settings.minProbability) return
        const label = labelFor(event, marketKey, selectionKey)
        if (!label) return
        const edge = fairProbability * best.odd - 1
        const probabilityPct = fairProbability * 100
        const edgePct = edge * 100
        const booksBonus = Math.min(12, perBook.length * 2)
        const agreementBonus = Math.max(0, 14 - spread * 160)
        const quality = clamp(52 + probabilityPct * 0.22 + Math.max(-4, edgePct) * 0.55 + booksBonus + agreementBonus, 50, 95)
        candidates.push({
          event,
          marketKey,
          selectionKey,
          market: label.market,
          prediction: label.prediction,
          odds: round(best.odd, 2),
          bookmaker: best.bookmaker,
          probability: round(probabilityPct, 1),
          implied: round((1 / best.odd) * 100, 2),
          edge: round(edgePct, 2),
          booksCount: perBook.length,
          spread: round(spread * 100, 2),
          quality: Math.round(quality),
          mode: edge >= 0.005 ? 'value' : 'market_consensus'
        })
      })
    })
  })
  return candidates
}

function getBotPolicy(bot, settings = {}, query = {}) {
  const base = BOT_POLICIES[bot] || BOT_POLICIES.betai
  const prefix = bot === 'betai' ? 'BETAI_VALUE_V2' : bot === 'typer' ? 'TYPER_EXPERT' : 'OGRAC_BUKA'
  const envNumber = (name, fallback) => number(process.env[`${prefix}_${name}`], fallback)
  const botQueryValue = (name) => query[`${bot}_${name}`]
  // Zakres kursów może być wspólny, lecz wszystkie pozostałe progi pozostają osobne.
  const minOdds = clamp(botQueryValue('min_odds') ?? query.min_odds ?? envNumber('MIN_ODDS', base.minOdds), 1.2, 5)
  const maxOdds = clamp(botQueryValue('max_odds') ?? query.max_odds ?? envNumber('MAX_ODDS', base.maxOdds), minOdds, 5)
  return {
    ...base,
    minOdds: Math.max(settings.minOdds || 1.2, minOdds),
    maxOdds: Math.min(settings.maxOdds || 5, maxOdds),
    minBooks: Math.round(clamp(botQueryValue('min_books') ?? envNumber('MIN_BOOKS', base.minBooks), 1, 8)),
    minProbability: clamp(botQueryValue('min_probability_pct') ?? envNumber('MIN_PROBABILITY_PCT', base.minProbability), 10, 80),
    minEdge: clamp(botQueryValue('min_edge_pct') ?? envNumber('MIN_EDGE_PCT', base.minEdge), -5, 25),
    maxSpread: clamp(botQueryValue('max_spread_pct') ?? envNumber('MAX_SPREAD_PCT', base.maxSpread), 1, 25),
    cooldownHours: clamp(botQueryValue('cooldown_hours') ?? envNumber('COOLDOWN_HOURS', base.cooldownHours), 1, 48)
  }
}

function candidateTier(candidate, policy) {
  if (!candidate || !policy) return ''
  if (candidate.odds < policy.minOdds || candidate.odds > policy.maxOdds) return ''
  if (!policy.allowedMarkets.includes(candidate.marketKey)) return ''
  if (!policy.allowedSelections.includes(candidate.selectionKey)) return ''
  const strict = candidate.booksCount >= policy.minBooks &&
    candidate.probability >= policy.minProbability &&
    candidate.edge >= policy.minEdge &&
    candidate.spread <= policy.maxSpread
  if (strict) return 'strict'
  const fallback = policy.fallback || {}
  const relaxed = candidate.booksCount >= number(fallback.minBooks, policy.minBooks) &&
    candidate.probability >= number(fallback.minProbability, policy.minProbability) &&
    candidate.edge >= number(fallback.minEdge, policy.minEdge) &&
    candidate.spread <= number(fallback.maxSpread, policy.maxSpread)
  return relaxed ? 'fallback' : ''
}

function scoreCandidate(candidate, bot) {
  const edge = number(candidate.edge)
  const probability = number(candidate.probability)
  const books = number(candidate.booksCount)
  const spread = number(candidate.spread)
  const odds = number(candidate.odds)
  const api = candidate.apiEvidence || {}
  const apiBonus = api.supported ? 16 : api.unavailable ? 0 : api.contrary ? -18 : -4
  const tierBonus = candidate.strategyTier === 'strict' ? 8 : 0

  // BetAI: szeroko szuka realnego value i konsensusu wielu bukmacherów.
  if (bot === 'betai') {
    const marketBonus = candidate.marketKey === 'match_winner' ? 3 : candidate.marketKey === 'goals_2_5' ? 2 : 1
    return edge * 4.2 + probability * 0.65 + books * 3.2 - spread * 1.35 + candidate.quality + marketBonus + tierBonus
  }

  // Typer Expert: najwyżej ocenia stabilność, prawdopodobieństwo i potwierdzenie API.
  if (bot === 'typer') {
    const highOddsPenalty = Math.max(0, odds - 2.65) * 10
    const safeOddsBonus = odds >= 1.5 && odds <= 2.35 ? 12 : 0
    return probability * 1.55 + books * 5.2 - spread * 3.2 + Math.max(edge, -2) * 1.1 + candidate.quality + apiBonus + safeOddsBonus - highOddsPenalty + tierBonus
  }

  // Ograć Buka: selektywny model API-Football, mała rozbieżność rynku,
  // stała stawka i brak progresji. Zakres 1.50–5.00 pozostaje dostępny,
  // lecz kursy powyżej 2.45 muszą nadrabiać realnym value i potwierdzeniem API.
  const preferredOddsBonus = odds >= 1.5 && odds <= 2.45 ? 16 : Math.max(-12, 8 - (odds - 2.45) * 10)
  return edge * 4.4 + probability * 1.05 + books * 4.4 - spread * 3.1 + candidate.quality + apiBonus + preferredOddsBonus + tierBonus
}

function apiStrategyPass(candidate, bot) {
  if (bot === 'betai') return true
  const api = candidate.apiEvidence || { unavailable: true }
  if (bot === 'typer') {
    if (api.supported) return true
    if (api.contrary) return false
    // Przy braku prognozy API dopuszczamy wyłącznie bardzo stabilny konsensus rynku.
    return candidate.booksCount >= 3 && candidate.probability >= 28 && candidate.spread <= 7
  }
  if (api.supported) return true
  if (api.contrary) return false
  // Brak odpowiedzi /predictions nie blokuje awaryjnie tylko wyjątkowo stabilnego value.
  return candidate.edge >= 5 && candidate.booksCount >= 3 && candidate.spread <= 6.5
}

function rankBotCandidates(candidates, bot, policy) {
  return candidates
    .map(candidate => ({ ...candidate, strategyTier: candidateTier(candidate, policy), strategyName: policy.strategyName }))
    .filter(candidate => candidate.strategyTier)
    .sort((a, b) => scoreCandidate(b, bot) - scoreCandidate(a, bot))
}

function selectDistinct(shortlists, bots) {
  const selected = {}
  const usedFixtures = new Set()
  bots.forEach(bot => {
    const ranked = (shortlists[bot] || [])
      .filter(candidate => apiStrategyPass(candidate, bot))
      .sort((a, b) => scoreCandidate(b, bot) - scoreCandidate(a, bot))
    // Strategie są niezależne. Unikalny mecz jest tylko preferencją, nie blokadą.
    const pick = ranked.find(candidate => !usedFixtures.has(candidate.event.fixtureId)) || ranked[0] || null
    if (pick) {
      selected[bot] = pick
      usedFixtures.add(pick.event.fixtureId)
    }
  })
  return selected
}

function predictionSupport(candidate, row) {
  const predictions = row?.predictions || {}
  const winner = clean(predictions?.winner?.name).toLowerCase()
  const home = candidate.event.home.toLowerCase()
  const away = candidate.event.away.toLowerCase()
  const underOver = clean(predictions?.under_over).toLowerCase()
  const percent = row?.predictions?.percent || row?.comparison || {}
  let supported = false
  let contrary = false
  let detail = ''
  if (candidate.marketKey === 'match_winner') {
    if (candidate.selectionKey === 'home') supported = Boolean(winner && (winner.includes(home) || home.includes(winner)))
    if (candidate.selectionKey === 'away') supported = Boolean(winner && (winner.includes(away) || away.includes(winner)))
    if (candidate.selectionKey === 'draw') supported = Boolean(predictions?.win_or_draw) && !winner
    contrary = Boolean(winner) && !supported
    detail = winner ? `Prognoza API wskazuje: ${predictions?.winner?.name}.` : ''
  } else if (candidate.marketKey === 'goals_2_5') {
    if (candidate.selectionKey === 'over_2_5') supported = /\+?2\.5|over/.test(underOver)
    if (candidate.selectionKey === 'under_2_5') supported = /-?2\.5|under/.test(underOver)
    contrary = Boolean(underOver) && !supported
    detail = underOver ? `Prognoza goli API: ${predictions?.under_over}.` : ''
  } else if (candidate.marketKey === 'btts') {
    const goals = predictions?.goals || {}
    const h = number(String(goals?.home || '').split('-')[0], 0)
    const a = number(String(goals?.away || '').split('-')[0], 0)
    const hasGoalsEvidence = goals?.home != null && goals?.away != null
    supported = candidate.selectionKey === 'yes' ? h > 0 && a > 0 : h === 0 || a === 0
    contrary = Boolean(hasGoalsEvidence) && !supported
  }
  return { supported, contrary, available: true, detail, advice: clean(predictions?.advice), percent }
}

async function enrichPredictionShortlists(context, shortlists) {
  const targets = []
  const seen = new Set()
  ;['typer', 'ograc'].forEach(bot => {
    const policy = BOT_POLICIES[bot]
    ;(shortlists[bot] || []).slice(0, policy.predictionLookups || 0).forEach(candidate => {
      const key = candidate.event.fixtureId
      if (seen.has(key)) return
      seen.add(key)
      targets.push(candidate)
    })
  })
  const results = await Promise.allSettled(targets.map(candidate => apiGet('/predictions', { fixture: candidate.event.fixtureId }, context)))
  const predictionRowsByFixture = new Map()
  results.forEach((result, index) => {
    const candidate = targets[index]
    if (result.status === 'rejected') {
      context.errors.push(`predictions ${candidate.event.fixtureId}: ${result.reason?.message || result.reason}`)
      predictionRowsByFixture.set(candidate.event.fixtureId, null)
      return
    }
    predictionRowsByFixture.set(candidate.event.fixtureId, result.value?.[0] || null)
  })
  ;['typer', 'ograc'].forEach(bot => {
    ;(shortlists[bot] || []).forEach(candidate => {
      const row = predictionRowsByFixture.get(candidate.event.fixtureId)
      candidate.apiEvidence = row
        ? predictionSupport(candidate, row)
        : { supported: false, contrary: false, unavailable: true, available: false, detail: '', advice: '' }
    })
  })
}

function missingColumn(error) {
  const message = String(error?.message || error || '')
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match ? match[1] : ''
}
const FALLBACK_COLUMNS = {
  tips: [
    'created_at', 'author_id', 'author_name', 'league', 'team_home', 'team_away',
    'match_time', 'bet_type', 'odds', 'analysis', 'ai_probability', 'access_type',
    'price', 'status', 'tags', 'notify_followers'
  ],
  ai_bets: [
    'created_at', 'updated_at', 'external_fixture_id', 'match_date', 'match_time',
    'home_team', 'away_team', 'country', 'league', 'market', 'prediction', 'odds',
    'probability', 'ev', 'ai_score', 'status', 'result', 'profit', 'source'
  ]
}
async function insertSafe(supabase, table, row, maxAttempts = 8) {
  const full = { ...row }
  const first = await supabase.from(table).insert(full).select('id').single()
  if (!first.error) return { data: first.data, removed: [] }
  if (!missingColumn(first.error)) throw first.error

  const allowed = new Set(FALLBACK_COLUMNS[table] || Object.keys(full))
  const payload = Object.fromEntries(Object.entries(full).filter(([key, value]) => allowed.has(key) && value !== undefined))
  const removed = Object.keys(full).filter(key => !Object.prototype.hasOwnProperty.call(payload, key))
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(payload).select('id').single()
    if (!error) return { data, removed }
    const column = missingColumn(error)
    if (column && Object.prototype.hasOwnProperty.call(payload, column)) {
      delete payload[column]
      removed.push(column)
      continue
    }
    throw error
  }
  throw new Error(`Too many missing-column retries for ${table}: ${removed.join(', ')}`)
}
function warsawParts(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(iso)).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}
function buildTipRow(candidate, bot) {
  const author = AUTHORS[bot]
  const evidence = candidate.apiEvidence || null
  const apiBoost = evidence?.supported ? 5 : 0
  const aiScore = Math.round(clamp(candidate.quality + apiBoost, 50, 97))
  const strategyText = bot === 'betai'
    ? 'BetAI MultiSport AI: szeroki silnik value, realne kursy i konsensus bukmacherów.'
    : bot === 'typer'
      ? 'Typer Expert: konserwatywna selekcja, stabilność rynku i potwierdzenie modelu.'
      : 'Ograć Buka: selektywny model API-Football, dodatnie value i stała stawka bez progresji.'
  const analysisParts = [
    strategyText,
    `${candidate.mode === 'value' ? 'Model value' : 'Konsensus rynku'}: ${candidate.prediction}.`,
    `Realny kurs ${candidate.odds} u ${candidate.bookmaker}.`,
    `Konsensus ${candidate.probability}% z ${candidate.booksCount} bukmacherów; szacowane value ${candidate.edge}%.`,
    `Poziom selekcji: ${candidate.strategyTier === 'strict' ? 'główny' : 'rezerwowy'}.`,
    evidence?.detail || '',
    evidence?.advice ? `API-Football: ${evidence.advice}.` : '',
    bot === 'ograc' ? 'Stała wirtualna stawka 1 jednostki; bez progresji.' : '',
    'Brak gwarancji wyniku.'
  ].filter(Boolean)
  const now = new Date().toISOString()
  return {
    created_at: now,
    updated_at: now,
    author_name: author.name,
    username: author.username,
    public_slug: author.username,
    author_id: null,
    user_id: null,
    league: candidate.event.league,
    country: candidate.event.country,
    team_home: candidate.event.home,
    team_away: candidate.event.away,
    match_name: `${candidate.event.home} vs ${candidate.event.away}`,
    match: `${candidate.event.home} vs ${candidate.event.away}`,
    match_time: candidate.event.kickoff,
    event_time: candidate.event.kickoff,
    kickoff_time: candidate.event.kickoff,
    match_date: candidate.event.matchDate,
    fixture_id: candidate.event.fixtureId,
    external_fixture_id: candidate.event.fixtureId,
    api_fixture_id: candidate.event.fixtureId,
    league_id: candidate.event.leagueId || null,
    sport: 'Piłka nożna',
    sport_key: 'football',
    bet_type: candidate.prediction,
    prediction: candidate.prediction,
    pick: candidate.prediction,
    selection: candidate.prediction,
    market: candidate.market,
    market_key: candidate.marketKey,
    selection_key: candidate.selectionKey,
    odds: candidate.odds,
    bookmaker: candidate.bookmaker,
    odds_bookmaker: candidate.bookmaker,
    analysis: analysisParts.join(' ').slice(0, 900),
    ai_probability: Math.round(candidate.probability),
    probability: Math.round(candidate.probability),
    model_probability: Math.round(candidate.probability),
    ai_score: aiScore,
    ai_confidence: aiScore,
    implied_probability: candidate.implied,
    value_score: candidate.edge,
    ev: candidate.edge,
    quality_label: bot === 'betai' ? 'BETAI VALUE SCAN' : bot === 'typer' ? 'TYPER EXPERT SAFE' : 'OGRAĆ BUKA SELECTIVE API',
    source: author.source,
    tip_source: author.source,
    ai_source: VERSION,
    ai_model_version: VERSION,
    ai_external_key: `${author.source}|${candidate.event.fixtureId}|${candidate.marketKey}|${candidate.selectionKey}`,
    access_type: 'free',
    is_premium: false,
    price: 0,
    status: 'pending',
    result: null,
    settlement_status: 'pending',
    result_status: null,
    stake: 1,
    profit: 0,
    payout: 0,
    return_amount: 0,
    coupon_type: 'single',
    is_ako: false,
    legs_count: 1,
    tags: [author.username, 'real-odds', candidate.mode, candidate.strategyTier || 'strict', evidence?.supported ? 'api-confirmed' : 'market-confirmed'],
    notify_followers: true
  }
}
function buildAiBetRow(tip) {
  const local = warsawParts(tip.event_time)
  return {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    external_fixture_id: String(tip.external_fixture_id),
    match_date: local.date,
    match_time: local.time,
    home_team: tip.team_home,
    away_team: tip.team_away,
    country: tip.country,
    league: tip.league,
    market: tip.market,
    prediction: tip.prediction,
    odds: tip.odds,
    probability: tip.probability,
    ev: tip.ev,
    ai_score: tip.ai_score,
    status: 'pending',
    result: null,
    profit: 0,
    source: AUTHORS.betai.source
  }
}

async function loadRecentBotTips(supabase, bots) {
  const names = bots.map(bot => AUTHORS[bot].name)
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const { data, error } = await supabase.from('tips').select('*').in('author_name', names).gte('created_at', since).order('created_at', { ascending: false }).limit(150)
  if (error) throw error
  return data || []
}
function isActiveFutureTip(row) {
  const status = String(row?.status || row?.result || row?.settlement_status || '').toLowerCase()
  if (/(won|win|lost|loss|void|push|settled|wygran|przegran|zwrot)/.test(status)) return false
  const kickoff = row?.event_time || row?.kickoff_time || row?.match_time
  const ts = Date.parse(kickoff)
  return Number.isFinite(ts) ? ts > Date.now() : false
}
function duplicateKey(row) {
  return String(row?.fixture_id || row?.external_fixture_id || row?.api_fixture_id || '').trim()
}
async function mirrorAiBet(supabase, tip) {
  const row = buildAiBetRow(tip)
  const { data: existing, error: findError } = await supabase.from('ai_bets').select('id,status,result').eq('external_fixture_id', row.external_fixture_id).eq('market', row.market).eq('prediction', row.prediction).limit(1)
  if (findError) throw findError
  if (existing?.[0]?.id) {
    const updateRow = { ...row }
    delete updateRow.created_at
    const { error } = await supabase.from('ai_bets').update(updateRow).eq('id', existing[0].id)
    if (error) throw error
    return { id: existing[0].id, updated: true }
  }
  const out = await insertSafe(supabase, 'ai_bets', row, 25)
  return { id: out.data?.id, updated: false, removed: out.removed }
}
async function recordRun(supabase, payload) {
  try {
    await supabase.from('ai_pick_runs').insert({
      source: VERSION,
      status: payload.ok ? 'success' : 'error',
      picks_created: payload.inserted || 0,
      error_message: payload.errors?.length ? payload.errors.slice(0, 10).join(' | ').slice(0, 1800) : null,
      finished_at: new Date().toISOString(),
      details: payload
    })
  } catch (_) {}
}

function parseBots(value) {
  const requested = String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
  const bots = (requested.length ? requested : DEFAULT_BOTS).filter(bot => AUTHORS[bot])
  return [...new Set(bots)]
}

async function runAiBotCycle(event = {}, options = {}) {
  const env = getEnvironment()
  const query = event.queryStringParameters || {}
  const bots = parseBots(options.bots || query.bots)
  const dryRun = ['1', 'true', 'yes'].includes(String(query.dry_run || '').toLowerCase())
  const force = ['1', 'true', 'yes'].includes(String(query.force || '').toLowerCase())
  const settings = {
    days: Math.round(clamp(query.days || 2, 1, 2)),
    minMinutes: clamp(query.min_minutes_before_start || 45, 30, 360),
    maxHours: clamp(query.max_hours_ahead || 72, 12, 96),
    // Surowa pula jest szeroka. Właściwe progi są osobne dla każdego bota.
    minOdds: clamp(query.min_odds || 1.50, 1.2, 5),
    maxOdds: clamp(query.max_odds || 5.00, 1.5, 5),
    minProbability: 0.12,
    minBooks: 1
  }
  const botPolicies = Object.fromEntries(bots.map(bot => [bot, getBotPolicy(bot, settings, query)]))
  const context = { apiKey: env.apiKey, apiCalls: 0, apiRemaining: null, apiDurations: [], errors: [] }
  const startedAt = Date.now()
  if (!env.supabaseUrl || !env.serviceKey || !env.apiKey) {
    return {
      ok: false,
      version: VERSION,
      inserted: 0,
      error: 'Brak wymaganych zmiennych Netlify ENV.',
      env: { SUPABASE_URL: Boolean(env.supabaseUrl), SUPABASE_SERVICE_ROLE_KEY: Boolean(env.serviceKey), APISPORTS_KEY: Boolean(env.apiKey) }
    }
  }

  const supabase = createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } })
  let recentTips = []
  try { recentTips = await loadRecentBotTips(supabase, bots) } catch (error) { context.errors.push(`recent tips: ${error.message || error}`) }

  const blocked = {}
  bots.forEach(bot => {
    const author = AUTHORS[bot]
    const policy = botPolicies[bot]
    const latest = recentTips.find(row => row.author_name === author.name)
    const active = recentTips.find(row => row.author_name === author.name && isActiveFutureTip(row))
    const latestAgeHours = latest?.created_at ? (Date.now() - Date.parse(latest.created_at)) / 3_600_000 : Infinity
    if (!force && active) blocked[bot] = 'active_pick_exists'
    else if (!force && latest && latestAgeHours < policy.cooldownHours) blocked[bot] = `cooldown_${policy.cooldownHours}h`
  })
  const botsToRun = bots.filter(bot => !blocked[bot])
  if (!botsToRun.length && !dryRun) {
    const result = { ok: true, version: VERSION, inserted: 0, skipped: blocked, message: 'Każdy bot ma aktywny typ albo jest w krótkim cooldownie.', elapsed_ms: Date.now() - startedAt, errors: context.errors }
    await recordRun(supabase, result)
    return result
  }

  const dates = Array.from({ length: settings.days }, (_, index) => todayWarsaw(index))
  const [events, oddsMap] = await Promise.all([
    fetchFixtures(context, settings, dates),
    fetchOdds(context, dates)
  ])
  const candidates = buildCandidates(events, oddsMap, settings)
  const shortlists = {}
  const strategyDiagnostics = {}
  botsToRun.forEach(bot => {
    const ownName = AUTHORS[bot].name
    const ownRecentFixtures = new Set(recentTips
      .filter(row => row.author_name === ownName)
      .map(duplicateKey)
      .filter(Boolean))
    const ownFreshPool = candidates.filter(candidate => !ownRecentFixtures.has(candidate.event.fixtureId))
    const ranked = rankBotCandidates(ownFreshPool.length ? ownFreshPool : candidates, bot, botPolicies[bot])
    shortlists[bot] = ranked.slice(0, Math.max(8, botPolicies[bot].predictionLookups || 0))
    strategyDiagnostics[bot] = {
      strategy: botPolicies[bot].strategyName,
      strict_candidates: ranked.filter(candidate => candidate.strategyTier === 'strict').length,
      fallback_candidates: ranked.filter(candidate => candidate.strategyTier === 'fallback').length,
      cooldown_hours: botPolicies[bot].cooldownHours
    }
  })
  await enrichPredictionShortlists(context, shortlists)
  const selected = selectDistinct(shortlists, botsToRun)

  const diagnostics = {
    fixtures_found: events.length,
    odds_fixtures_found: oddsMap.size,
    candidates_found: candidates.length,
    strategy_candidates: strategyDiagnostics,
    api_calls: context.apiCalls,
    api_remaining: context.apiRemaining,
    api_durations: context.apiDurations,
    errors: context.errors.slice(0, 20)
  }

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      version: VERSION,
      bots,
      blocked,
      settings,
      bot_policies: botPolicies,
      ...diagnostics,
      selected: Object.fromEntries(Object.entries(selected).map(([bot, candidate]) => [bot, {
        author: AUTHORS[bot].name,
        fixture_id: candidate.event.fixtureId,
        match: `${candidate.event.home} vs ${candidate.event.away}`,
        kickoff: candidate.event.kickoff,
        prediction: candidate.prediction,
        odds: candidate.odds,
        probability: candidate.probability,
        edge: candidate.edge,
        bookmaker: candidate.bookmaker,
        api_supported: Boolean(candidate.apiEvidence?.supported),
        strategy: candidate.strategyName,
        strategy_tier: candidate.strategyTier
      }]))
    }
  }

  const outcomes = await Promise.all(botsToRun.map(async bot => {
    const candidate = selected[bot]
    if (!candidate) return { bot, author: AUTHORS[bot].name, inserted: 0, reason: 'no_real_odds_candidate' }
    const tip = buildTipRow(candidate, bot)
    try {
      const saved = await insertSafe(supabase, 'tips', tip)
      const outcome = { bot, author: AUTHORS[bot].name, inserted: 1, id: saved.data?.id, removed_columns: saved.removed, pick: tip }
      if (AUTHORS[bot].mirrorAiBets) {
        try {
          outcome.ai_bets = await mirrorAiBet(supabase, tip)
        } catch (error) {
          outcome.ai_bets_error = error.message || String(error)
          context.errors.push(`ai_bets mirror: ${error.message || error}`)
        }
      }
      return outcome
    } catch (error) {
      context.errors.push(`insert ${bot}: ${error.message || error}`)
      return { bot, author: AUTHORS[bot].name, inserted: 0, error: error.message || String(error), candidate: tip }
    }
  }))
  const inserted = outcomes.reduce((sum, outcome) => sum + Number(outcome.inserted || 0), 0)
  const aiBetsInserted = outcomes.reduce((sum, outcome) => sum + (outcome.ai_bets ? 1 : 0), 0)

  const result = {
    ok: inserted > 0 || Object.keys(blocked).length > 0,
    version: VERSION,
    inserted,
    ai_bets_inserted: aiBetsInserted,
    bots_requested: bots,
    bots_run: botsToRun,
    skipped: blocked,
    outcomes,
    settings,
    bot_policies: botPolicies,
    ...diagnostics,
    errors: context.errors.slice(0, 25),
    elapsed_ms: Date.now() - startedAt,
    message: inserted > 0
      ? `Zapisano ${inserted} typy z trzech niezależnych strategii. Wspólne było tylko pobranie danych API.`
      : 'Nie zapisano typu. Odpowiedź zawiera dokładną liczbę meczów, kursów, kandydatów i błędy API.'
  }
  await recordRun(supabase, result)
  return result
}

function createHandler(options = {}) {
  return async function handler(event = {}) {
    if (event.httpMethod === 'OPTIONS') return json(204, {})
    try {
      const result = await runAiBotCycle(event, options)
      return json(result.ok === false ? 500 : 200, result)
    } catch (error) {
      return json(500, { ok: false, version: VERSION, inserted: 0, error: error.message || String(error) })
    }
  }
}

module.exports = { AUTHORS, VERSION, BOT_POLICIES, runAiBotCycle, createHandler, json, _test: { parseMarket, buildCandidates, scoreCandidate, labelFor, candidateTier, rankBotCandidates, apiStrategyPass, getBotPolicy } }
