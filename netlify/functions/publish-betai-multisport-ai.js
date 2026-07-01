const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY

// Ta funkcja dotyczy wyłącznie profilu BetAI MultiSport AI.
const AUTHOR_NAME = 'BetAI MultiSport AI'
const USERNAME = 'betai-multisport-ai'
const VERSION = '1867.2-betai-football-market-value-balanced-v4'
const SOURCE = 'betai_value_engine_v3'

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
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value, min)))
}
function clean(value, fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
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
    league: clean(league?.name, 'Piłka nożna'),
    league_id: league?.id ? String(league.id) : null,
    country: clean(league?.country),
    sport: 'Piłka nożna',
    sport_key: 'football'
  }
}

function isLowQualityFixture(ev) {
  const text = `${ev.home} ${ev.away} ${ev.league}`.toLowerCase()
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

function parseMarket(betName, values) {
  const bet = normalizeBetName(betName)
  const out = {}

  if (['match winner', 'fulltime result', 'full time result', '1x2', 'result'].includes(bet)) {
    values.forEach(value => {
      const name = normalizeValueName(value?.value)
      const odd = n(value?.odd, 0)
      if (name === 'home' || name === '1') out.home = odd
      else if (name === 'draw' || name === 'x') out.draw = odd
      else if (name === 'away' || name === '2') out.away = odd
    })
    return Object.keys(out).length === 3 ? { marketKey: 'match_winner', outcomes: out } : null
  }

  if (['goals over/under', 'over/under', 'total goals', 'match goals', 'goals'].includes(bet)) {
    values.forEach(value => {
      const name = normalizeValueName(value?.value)
      const odd = n(value?.odd, 0)
      if (/^over\s*2\.5$/.test(name)) out.over_2_5 = odd
      else if (/^under\s*2\.5$/.test(name)) out.under_2_5 = odd
    })
    return Object.keys(out).length === 2 ? { marketKey: 'goals_2_5', outcomes: out } : null
  }

  if (['both teams score', 'both teams to score', 'btts'].includes(bet)) {
    values.forEach(value => {
      const name = normalizeValueName(value?.value)
      const odd = n(value?.odd, 0)
      if (name === 'yes') out.yes = odd
      else if (name === 'no') out.no = odd
    })
    return Object.keys(out).length === 2 ? { marketKey: 'btts', outcomes: out } : null
  }

  return null
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
      const parsed = parseMarket(bet?.name, Array.isArray(bet?.values) ? bet.values : [])
      if (!parsed || !validOdds(parsed.outcomes)) continue
      groups.push({ bookmaker: bookmakerName, ...parsed })
    }
  }
  return groups
}

async function fetchOddsGroups(dates, errors) {
  const map = new Map()
  const maxPages = clamp(process.env.BETAI_VALUE_V2_ODDS_MAX_PAGES || 8, 1, 20)
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
  if (marketKey === 'goals_2_5' && selectionKey === 'over_2_5') {
    return { market: 'Gole', prediction: 'Powyżej 2.5 gola' }
  }
  if (marketKey === 'btts' && selectionKey === 'yes') {
    return { market: 'BTTS', prediction: 'Obie drużyny strzelą: TAK' }
  }
  return null
}

function candidateFromMarket(ev, marketKey, groups, settings) {
  const eligibleSelections = marketKey === 'match_winner'
    ? ['home', 'away']
    : marketKey === 'goals_2_5'
      ? ['over_2_5']
      : marketKey === 'btts'
        ? ['yes']
        : []

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

    // Odrzucamy pojedynczy odstający lub potencjalnie nieaktualny kurs.
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
    const agreementBonus = Math.max(0, 12 - probabilitySpread * 180)
    const booksBonus = Math.min(10, usable.length * 1.2)
    const score = clamp(58 + edgePct * 2.2 + agreementBonus + booksBonus, 60, 94)

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

function buildTipRow(ev, pick) {
  const now = new Date().toISOString()
  return {
    ai_external_key: `${SOURCE}|${ev.fixture_id}|${pick.market_key}|${pick.selection_key}`,
    external_fixture_id: ev.external_fixture_id,
    api_fixture_id: ev.api_fixture_id,
    fixture_id: ev.fixture_id,

    author_name: AUTHOR_NAME,
    username: USERNAME,
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
    stake: 1,
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
    ai_score: Math.round(pick.ai_score),
    ai_confidence: Math.round(pick.ai_score),
    probability: Math.round(pick.probability),
    model_probability: Math.round(pick.probability),
    implied_probability: round(pick.implied, 2),
    value_score: round(pick.ev, 2),
    ev: round(pick.ev, 2),
    quality_label: 'MARKET VALUE V2',
    analysis: `BetAI Value V2: ${pick.prediction}. Realny kurs ${pick.odds} (${pick.bookmaker}). Konsensus po usunięciu marży: ${pick.probability}% na podstawie ${pick.books_count} bukmacherów. Szacowane value: ${pick.ev}%. Rozrzut ocen rynku: ${pick.probability_spread} pp. Typ opublikowany tylko po przejściu rygorystycznych filtrów jakości; brak gwarancji wyniku.`,

    created_at: now,
    updated_at: now
  }
}

function warsawDateTimeParts(value) {
  const date = new Date(value || Date.now())
  const safe = Number.isFinite(date.getTime()) ? date : new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(safe).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour || '12'}:${parts.minute || '00'}`
  }
}

function buildAiBetRow(tipRow) {
  const local = warsawDateTimeParts(tipRow.event_time || tipRow.kickoff_time || tipRow.match_time)
  return {
    external_fixture_id: String(tipRow.external_fixture_id || tipRow.fixture_id || tipRow.ai_external_key || ''),
    match_date: local.date,
    match_time: local.time,
    home_team: tipRow.team_home,
    away_team: tipRow.team_away,
    country: tipRow.country || 'API-Football',
    league: tipRow.league || 'Football',
    market: tipRow.market || tipRow.bet_type || 'AI pick',
    prediction: tipRow.prediction || tipRow.pick || tipRow.selection || 'AI prediction',
    odds: n(tipRow.odds, 1.5),
    probability: Math.round(n(tipRow.probability || tipRow.model_probability, 60)),
    ev: round(n(tipRow.ev || tipRow.value_score, 0), 2),
    ai_score: Math.round(n(tipRow.ai_score || tipRow.ai_confidence, 60)),
    status: clean(tipRow.status, 'pending').toLowerCase(),
    result: tipRow.result ? clean(tipRow.result).toLowerCase() : null,
    profit: n(tipRow.profit, 0),
    source: SOURCE,
    updated_at: new Date().toISOString()
  }
}

async function saveAiBetMirror(supabase, tipRow) {
  const row = buildAiBetRow(tipRow)
  if (!row.external_fixture_id || !row.home_team || !row.away_team) return { saved: 0, reason: 'missing_identity' }

  const { data: existing, error: findError } = await supabase
    .from('ai_bets')
    .select('id,status,result')
    .eq('external_fixture_id', row.external_fixture_id)
    .eq('market', row.market)
    .eq('prediction', row.prediction)
    .limit(1)
  if (findError) throw findError

  const existingId = existing?.[0]?.id
  if (existingId) {
    const settled = ['won','lost','void','push','win','loss'].includes(String(existing?.[0]?.status || existing?.[0]?.result || '').toLowerCase())
    const updateRow = settled
      ? Object.fromEntries(Object.entries(row).filter(([key]) => !['status','result','profit'].includes(key)))
      : row
    const { error } = await supabase.from('ai_bets').update(updateRow).eq('id', existingId)
    if (error) throw error
    return { saved: 1, id: existingId, updated: true }
  }

  const { data, error } = await supabase
    .from('ai_bets')
    .insert({ ...row, created_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return { saved: 1, id: data?.id, updated: false }
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
  for (let attempt = 0; attempt < 40; attempt++) {
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

async function getRecentAccountPick(supabase, cooldownHours) {
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .eq('author_name', AUTHOR_NAME)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length ? data[0] : null
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

// WERSJA 1867.3: zakres realnych kursów rozszerzony do 1.50–5.00. Pozostałe filtry jakości i cooldown pozostają aktywne.
exports.config = { schedule: '17 6,10,14,18,22 * * *' }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing SUPABASE_URL or SERVICE ROLE KEY' })
  if (!API_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing APISPORTS_KEY / API_FOOTBALL_KEY' })

  const q = event.queryStringParameters || {}
  const dryRun = ['1', 'true', 'yes'].includes(String(q.dry_run || '').toLowerCase())
  const force = ['1', 'true', 'yes'].includes(String(q.force || '').toLowerCase())
  const days = clamp(q.days || process.env.BETAI_VALUE_V2_LOOKAHEAD_DAYS || 2, 1, 3)
  const minMinutes = clamp(q.min_minutes_before_start || process.env.BETAI_VALUE_V2_MIN_MINUTES_BEFORE_START || 90, 60, 720)
  const maxHours = clamp(q.max_hours_ahead || process.env.BETAI_VALUE_V2_MAX_HOURS_AHEAD || 60, 6, 72)
  const cooldownHours = clamp(q.cooldown_hours || process.env.BETAI_VALUE_V2_COOLDOWN_HOURS || 10, 8, 48)

  const settings = {
    minBooks: clamp(q.min_books || process.env.BETAI_VALUE_V2_MIN_BOOKS || 3, 3, 15),
    minOdds: clamp(q.min_odds || process.env.BETAI_VALUE_V2_MIN_ODDS || 1.50, 1.2, 5),
    maxOdds: clamp(q.max_odds || process.env.BETAI_VALUE_V2_MAX_ODDS || 5.00, 1.5, 5),
    minProbability: clamp(q.min_probability || process.env.BETAI_VALUE_V2_MIN_PROBABILITY || 0.42, 0.35, 0.8),
    minEdge: clamp(q.min_edge || process.env.BETAI_VALUE_V2_MIN_EDGE || 0.015, 0.01, 0.2),
    maxProbabilitySpread: clamp(q.max_probability_spread || process.env.BETAI_VALUE_V2_MAX_PROBABILITY_SPREAD || 0.075, 0.01, 0.12),
    maxOddsOutlierRatio: clamp(q.max_odds_outlier_ratio || process.env.BETAI_VALUE_V2_MAX_ODDS_OUTLIER_RATIO || 1.12, 1.01, 1.2)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const errors = []

  if (!dryRun && !force) {
    try {
      const recentPick = await getRecentAccountPick(supabase, cooldownHours)
      if (recentPick) {
        let aiBetMirror = { saved: 0 }
        try { aiBetMirror = await saveAiBetMirror(supabase, recentPick) } catch (mirrorError) { errors.push(`ai_bets mirror: ${mirrorError.message || mirrorError}`) }
        return json(200, {
          ok: true,
          version: VERSION,
          author: AUTHOR_NAME,
          inserted: 0,
          ai_bets_saved: aiBetMirror.saved || 0,
          skipped: 'cooldown',
          recent_pick_id: recentPick.id,
          message: `Profil ma już typ z ostatnich ${cooldownHours} godzin. Nie tworzę duplikatu; istniejący typ został zsynchronizowany z ekranem Typy AI.`
        })
      }
    } catch (error) {
      return json(500, { ok: false, version: VERSION, error: `Cooldown check failed: ${error.message || error}` })
    }
  }

  const fixtures = await fetchFixtures(days, minMinutes, maxHours, errors)
  const dates = [...new Set(fixtures.map(item => item.match_date).filter(Boolean))]
  const oddsGroups = await fetchOddsGroups(dates, errors)

  const allCandidates = fixtures
    .flatMap(ev => candidatesForEvent(ev, oddsGroups, settings))
    .sort((a, b) => {
      const scoreDiff = n(b.pick.ai_score) - n(a.pick.ai_score)
      if (scoreDiff) return scoreDiff
      const edgeDiff = n(b.pick.ev) - n(a.pick.ev)
      if (edgeDiff) return edgeDiff
      return Date.parse(a.ev.event_time) - Date.parse(b.ev.event_time)
    })

  const uniqueFixtures = []
  const seenFixtures = new Set()
  for (const candidate of allCandidates) {
    if (seenFixtures.has(candidate.ev.fixture_id)) continue
    seenFixtures.add(candidate.ev.fixture_id)
    uniqueFixtures.push(candidate)
  }

  if (dryRun) {
    return json(200, {
      ok: true,
      dry_run: true,
      version: VERSION,
      author: AUTHOR_NAME,
      strategy: 'real bookmaker consensus + de-vig + best non-outlier price',
      fixtures_found: fixtures.length,
      odds_fixtures_found: oddsGroups.size,
      candidates: uniqueFixtures.slice(0, 10).map(({ ev, pick }) => buildTipRow(ev, pick)),
      settings,
      errors: errors.slice(0, 25)
    })
  }

  let selected = null
  for (const candidate of uniqueFixtures) {
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
      candidates_found: uniqueFixtures.length,
      message: 'Brak typu spełniającego wszystkie filtry V2. To jest prawidłowe zachowanie — silnik nie publikuje na siłę.',
      settings,
      errors: errors.slice(0, 25)
    })
  }

  const row = buildTipRow(selected.ev, selected.pick)
  try {
    const out = await insertSafe(supabase, row)
    let aiBetMirror = { saved: 0 }
    try { aiBetMirror = await saveAiBetMirror(supabase, row) } catch (mirrorError) { errors.push(`ai_bets mirror: ${mirrorError.message || mirrorError}`) }
    try {
      await supabase.from('ai_pick_runs').insert({
        source: VERSION,
        picks_created: aiBetMirror.saved || 1,
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
      ai_bets_saved: aiBetMirror.saved || 0,
      id: out.data?.id,
      ai_bet_id: aiBetMirror.id || null,
      removed_columns: out.removed,
      fixtures_found: fixtures.length,
      odds_fixtures_found: oddsGroups.size,
      candidates_found: uniqueFixtures.length,
      strategy: 'real bookmaker consensus + de-vig + best non-outlier price',
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
