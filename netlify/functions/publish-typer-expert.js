const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY

// WERSJA 1837 — osobny, wirtualny profil systemowy.
// Funkcja nie obstawia u bukmachera. Publikuje wyłącznie typy i wirtualne stawki na bet-ai.app.
const AUTHOR_NAME = 'Typer Expert'
const USERNAME = 'typer-expert'
const VERSION = '1837-typer-expert-progression-v1'
const SOURCE = 'typer_expert_progression_v1'

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
  const maxPages = clamp(process.env.TYPER_EXPERT_ODDS_MAX_PAGES || 8, 1, 20)
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
  const targetRemaining = Math.max(0, settings.targetProfit - n(state.cycleNet, 0))
  const rawRequired = Math.max(settings.baseStake, targetRemaining / Math.max(0.01, n(odds, 1) - 1))
  const requiredStake = ceilMoney(rawRequired)
  const stake = Math.min(settings.maxStake, Math.max(settings.baseStake, requiredStake))
  return {
    stake: round(stake, 2),
    requiredStake: round(requiredStake, 2),
    capped: requiredStake > settings.maxStake,
    step: Number(state.cycleStep || 0) + 1,
    cycleNetBefore: round(state.cycleNet, 2),
    targetProfit: round(settings.targetProfit, 2),
    possibleProfit: round((odds - 1) * stake, 2)
  }
}

function buildTipRow(ev, pick, progression) {
  const now = new Date().toISOString()
  const capText = progression.capped
    ? ` Wymagana stawka przekroczyła limit, dlatego zastosowano twardy limit ${progression.stake}.`
    : ''
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
    ai_score: Math.round(pick.ai_score),
    ai_confidence: Math.round(pick.ai_score),
    probability: Math.round(pick.probability),
    model_probability: Math.round(pick.probability),
    implied_probability: round(pick.implied, 2),
    value_score: round(pick.ev, 2),
    ev: round(pick.ev, 2),
    quality_label: 'TYPER EXPERT',
    tags: ['typer-expert', 'wirtualna-progresja'],
    analysis: `Typer Expert: ${pick.prediction}. Realny kurs ${pick.odds} (${pick.bookmaker}). Konsensus po usunięciu marży: ${pick.probability}% na podstawie ${pick.books_count} bukmacherów. Value: ${pick.ev}%. Wirtualna progresja: krok ${progression.step}, saldo bieżącego cyklu przed typem ${progression.cycleNetBefore >= 0 ? '+' : ''}${progression.cycleNetBefore}, stawka ${progression.stake}, cel cyklu +${progression.targetProfit}.${capText} Strategia nie gwarantuje zysku i nie wykonuje zakładów u bukmachera.`,

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

// Skan co 3 godziny. Nowy typ jest publikowany dopiero po rozliczeniu poprzedniego,
// ponieważ tylko wtedy progresja ma jednoznaczny stan.
exports.config = { schedule: '23 */3 * * *' }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing SUPABASE_URL or SERVICE ROLE KEY' })
  if (!API_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing APISPORTS_KEY / API_FOOTBALL_KEY' })

  const q = event.queryStringParameters || {}
  const dryRun = ['1', 'true', 'yes'].includes(String(q.dry_run || '').toLowerCase())
  const force = ['1', 'true', 'yes'].includes(String(q.force || '').toLowerCase())
  const days = clamp(q.days || process.env.TYPER_EXPERT_LOOKAHEAD_DAYS || 2, 1, 3)
  const minMinutes = clamp(q.min_minutes_before_start || process.env.TYPER_EXPERT_MIN_MINUTES_BEFORE_START || 90, 45, 720)
  const maxHours = clamp(q.max_hours_ahead || process.env.TYPER_EXPERT_MAX_HOURS_AHEAD || 24, 6, 72)

  const settings = {
    minBooks: clamp(q.min_books || process.env.TYPER_EXPERT_MIN_BOOKS || 4, 3, 15),
    minOdds: clamp(q.min_odds || process.env.TYPER_EXPERT_MIN_ODDS || 1.45, 1.2, 3),
    maxOdds: clamp(q.max_odds || process.env.TYPER_EXPERT_MAX_ODDS || 1.85, 1.35, 5),
    minProbability: clamp(q.min_probability || process.env.TYPER_EXPERT_MIN_PROBABILITY || 0.58, 0.45, 0.85),
    minEdge: clamp(q.min_edge || process.env.TYPER_EXPERT_MIN_EDGE || 0.012, 0, 0.2),
    maxProbabilitySpread: clamp(q.max_probability_spread || process.env.TYPER_EXPERT_MAX_PROBABILITY_SPREAD || 0.05, 0.01, 0.15),
    maxOddsOutlierRatio: clamp(q.max_odds_outlier_ratio || process.env.TYPER_EXPERT_MAX_ODDS_OUTLIER_RATIO || 1.06, 1.01, 1.2),
    baseStake: clamp(q.base_stake || process.env.TYPER_EXPERT_BASE_STAKE || 1, 1, 1000),
    maxStake: clamp(q.max_stake || process.env.TYPER_EXPERT_MAX_STAKE || 1000, 1, 1000),
    targetProfit: clamp(q.target_profit || process.env.TYPER_EXPERT_TARGET_PROFIT || 0.4, 0.01, 100)
  }

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
      message: 'Poprzedni typ Typer Expert nie jest jeszcze rozliczony. Silnik czeka, aby nie nakładać kilku kroków progresji jednocześnie.'
    })
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

  if (dryRun) {
    return json(200, {
      ok: true,
      dry_run: true,
      version: VERSION,
      author: AUTHOR_NAME,
      strategy: 'highest bookmaker-consensus probability + virtual recovery progression',
      fixtures_found: fixtures.length,
      odds_fixtures_found: oddsGroups.size,
      progression_state: {
        pending: progressionState.pending.length,
        cycle_net: progressionState.cycleNet,
        next_step: progressionState.cycleStep + 1,
        completed_cycles: progressionState.completedCycles,
        total_net: progressionState.totalNet
      },
      candidates: uniqueFixtures.slice(0, 10).map(({ ev, pick, progression }) => buildTipRow(ev, pick, progression)),
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
      message: 'Brak typu spełniającego filtry Typer Expert. Silnik nie publikuje wyboru na siłę.',
      progression_state: {
        cycle_net: progressionState.cycleNet,
        next_step: progressionState.cycleStep + 1,
        completed_cycles: progressionState.completedCycles,
        total_net: progressionState.totalNet
      },
      settings,
      errors: errors.slice(0, 25)
    })
  }

  const row = buildTipRow(selected.ev, selected.pick, selected.progression)
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
      strategy: 'highest bookmaker-consensus probability + virtual recovery progression',
      progression: selected.progression,
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
