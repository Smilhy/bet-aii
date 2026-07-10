const { createClient } = require('@supabase/supabase-js')
const {
  calculatePressureModel,
  chooseProbabilityBet,
  round,
  toFiniteNumber
} = require('./algorithm-model')

const API_BASE = 'https://v3.football.api-sports.io'
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
const UPCOMING_STATUSES = new Set(['NS', 'TBD'])
const SETTLED_STATUSES = new Set(['won', 'lost', 'void'])
const MODEL_VERSION = 'pressure-ou25-v5-prematch-throttled-worker'
const PREMATCH_MIN_LEAD_MINUTES = Math.max(1, Number(process.env.ALGORITHM_PREMATCH_MIN_LEAD_MINUTES || 10) || 10)
const API_MIN_INTERVAL_MS = Math.max(250, Number(process.env.ALGORITHM_API_MIN_INTERVAL_MS || 350) || 350)
const API_RATE_LIMIT_RETRY_MS = Math.max(15_000, Number(process.env.ALGORITHM_API_RATE_LIMIT_RETRY_MS || 65_000) || 65_000)
const API_MAX_RATE_RETRIES = Math.max(0, Math.min(3, Number(process.env.ALGORITHM_API_MAX_RATE_RETRIES || 2) || 2))
const MAX_MISSING_DATA_ATTEMPTS = Math.max(1, Math.min(6, Number(process.env.ALGORITHM_MAX_MISSING_DATA_ATTEMPTS || 2) || 2))
const MAX_HISTORY_STATS_CHECKS = Math.max(3, Math.min(15, Number(process.env.ALGORITHM_MAX_HISTORY_STATS_CHECKS || 8) || 8))

const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))))
let apiRequestChain = Promise.resolve()
let apiLastRequestStartedAt = 0

function queueApiRequest(task) {
  const run = apiRequestChain.then(async () => {
    const waitMs = Math.max(0, apiLastRequestStartedAt + API_MIN_INTERVAL_MS - Date.now())
    if (waitMs) await sleep(waitMs)
    apiLastRequestStartedAt = Date.now()
    return task()
  })
  apiRequestChain = run.catch(() => null)
  return run
}

function getApiKey() {
  return process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w Netlify.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function dateKeyInTimezone(value = new Date(), timeZone = process.env.APP_TIMEZONE || 'Europe/Warsaw') {
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

function shiftDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return date.toISOString().slice(0, 10)
}

function boolEnv(value, fallback = false) {
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'tak', 'on'].includes(String(value).trim().toLowerCase())
}

function chunk(items = [], size = 100) {
  const output = []
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size))
  return output
}

function median(values = []) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return 0
  const middle = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2
}

async function apiFetch(path, timeoutMs = 14000, options = {}) {
  const key = getApiKey()
  if (!key) throw new Error('Brak APISPORTS_KEY / API_FOOTBALL_KEY w Netlify.')
  const maxRateRetries = Math.max(0, Math.min(3, Number(options.maxRateRetries ?? API_MAX_RATE_RETRIES) || 0))

  return queueApiRequest(async () => {
    let lastError = null
    for (let attempt = 0; attempt <= maxRateRetries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          headers: { 'x-apisports-key': key },
          signal: controller.signal
        })
        const text = await response.text()
        let payload = null
        try { payload = JSON.parse(text) } catch (_) { payload = null }
        const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
        if (!response.ok || (errors && Object.keys(errors).length)) {
          const error = new Error(`API-Football ${response.status}: ${errors ? JSON.stringify(errors) : text.slice(0, 240)}`)
          error.status = response.status
          error.apiErrors = errors
          error.isRateLimit = response.status === 429 || /too many requests|rate|limit|quota|requests per minute/i.test(error.message)
          const retryAfterHeader = Number(response.headers.get('retry-after') || 0)
          error.retryAfterMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : API_RATE_LIMIT_RETRY_MS
          throw error
        }
        return payload || {}
      } catch (error) {
        lastError = error
        const isRateLimit = Boolean(error?.isRateLimit || /429|too many requests|rate|limit|quota|requests per minute/i.test(String(error?.message || error || '')))
        if (!isRateLimit || attempt >= maxRateRetries) throw error
        const retryMs = Math.max(API_RATE_LIMIT_RETRY_MS, Number(error?.retryAfterMs || 0))
        console.warn(`API-Football rate limit: retry ${attempt + 1}/${maxRateRetries} za ${retryMs} ms`, path)
        await sleep(retryMs)
        apiLastRequestStartedAt = Date.now()
      } finally {
        clearTimeout(timeout)
      }
    }
    throw lastError || new Error('Nieznany błąd API-Football.')
  })
}

async function fetchFixturesForDate(date, timezone) {
  const payload = await apiFetch(`/fixtures?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`)
  return Array.isArray(payload.response) ? payload.response : []
}

async function fetchOddsForDate(date, maxPagesInput) {
  const maxPages = Math.max(1, Math.min(100, Number(maxPagesInput || process.env.ALGORITHM_ODDS_MAX_PAGES || 3) || 3))
  const rows = []
  let page = 1
  while (page <= maxPages) {
    let payload
    try {
      payload = await apiFetch(`/odds?date=${encodeURIComponent(date)}&page=${page}`)
    } catch (error) {
      if (page === 1) throw error
      console.warn(`algorithm odds page ${page} skipped`, error?.message || error)
      break
    }
    const response = Array.isArray(payload.response) ? payload.response : []
    rows.push(...response)
    const current = Number(payload?.paging?.current || page)
    const total = Number(payload?.paging?.total || 1)
    if (!response.length || current >= total) break
    page += 1
  }
  return rows
}

async function fetchOddsForFixture(fixtureId) {
  if (!fixtureId) return null
  try {
    const payload = await apiFetch(`/odds?fixture=${encodeURIComponent(fixtureId)}`, 12000)
    const map = buildOverUnderOddsMap(Array.isArray(payload.response) ? payload.response : [])
    return map.get(String(fixtureId)) || null
  } catch (error) {
    console.warn(`algorithm fixture odds ${fixtureId} skipped`, error?.message || error)
    return null
  }
}

function normalizeOddLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildOverUnderOddsMap(rows = []) {
  const map = new Map()
  rows.forEach(row => {
    const fixtureId = String(row?.fixture?.id || row?.fixture_id || '')
    if (!fixtureId) return
    const prices = { over: [], under: [] }
    const bookmakers = Array.isArray(row?.bookmakers) ? row.bookmakers : []
    bookmakers.forEach(bookmaker => {
      const bookmakerName = String(bookmaker?.name || 'Bukmacher')
      const bets = Array.isArray(bookmaker?.bets) ? bookmaker.bets : []
      bets.forEach(bet => {
        const betId = Number(bet?.id || 0)
        const name = normalizeOddLabel(bet?.name)
        const isFullTimeTotals = betId === 5 || (
          (name.includes('goals over/under') || name === 'over/under' || name.includes('total goals')) &&
          !name.includes('first half') &&
          !name.includes('home') &&
          !name.includes('away')
        )
        if (!isFullTimeTotals) return
        const values = Array.isArray(bet?.values) ? bet.values : []
        values.forEach(value => {
          const label = normalizeOddLabel(value?.value)
          const odd = toFiniteNumber(value?.odd, 0)
          if (odd <= 1) return
          if (label === 'over 2.5' || label === 'over 2,5') prices.over.push({ odd, bookmaker: bookmakerName })
          if (label === 'under 2.5' || label === 'under 2,5') prices.under.push({ odd, bookmaker: bookmakerName })
        })
      })
    })
    if (!prices.over.length && !prices.under.length) return
    const summarize = list => {
      if (!list.length) return { best: 0, bestBookmaker: '', consensus: 0, books: 0 }
      const best = list.reduce((winner, current) => current.odd > winner.odd ? current : winner, list[0])
      return {
        best: round(best.odd, 2),
        bestBookmaker: best.bookmaker,
        consensus: round(median(list.map(item => item.odd)), 2),
        books: list.length
      }
    }
    map.set(fixtureId, { over: summarize(prices.over), under: summarize(prices.under) })
  })
  return map
}

function oddsFromExistingBet(row = {}) {
  const side = (odd, bookmaker = '') => {
    const value = toFiniteNumber(odd, 0)
    return value > 1
      ? { best: round(value, 2), bestBookmaker: String(bookmaker || ''), consensus: round(value, 2), books: 1 }
      : { best: 0, bestBookmaker: '', consensus: 0, books: 0 }
  }
  return {
    over: side(row.over_odds, row.over_bookmaker),
    under: side(row.under_odds, row.under_bookmaker)
  }
}

function mergeOddsSnapshot(current = {}, previous = {}) {
  const choose = (fresh, old) => toFiniteNumber(fresh?.best, 0) > 1 ? fresh : (old || { best: 0, bestBookmaker: '', consensus: 0, books: 0 })
  return {
    over: choose(current?.over, previous?.over),
    under: choose(current?.under, previous?.under)
  }
}

function isExcludedFixture(fixture = {}) {
  const text = [
    fixture?.league?.name,
    fixture?.league?.country,
    fixture?.teams?.home?.name,
    fixture?.teams?.away?.name
  ].filter(Boolean).join(' ').toLowerCase()

  return [
    /\bfriendly\b/,
    /\bfriendlies\b/,
    /\bkobiet\w*\b/,
    /\bwomen'?s?\b/,
    /\bfeminine\b/,
    /\bu-?1[56789]\b/,
    /\bu-?2[013]\b/,
    /\bunder\s*(17|18|19|20|21|23)\b/,
    /\breserve(s)?\b/,
    /\brezerwy\b/,
    /\byouth\b/
  ].some(pattern => pattern.test(text))
}

function fixtureKickoffMs(fixture = {}) {
  const value = Date.parse(fixture?.fixture?.date || '')
  return Number.isFinite(value) ? value : 0
}

async function mapConcurrent(items, limit, mapper) {
  const output = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      output[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return output
}

const fixtureStatsMemory = new Map()

async function readFixtureStatsCache(supabase, fixtureId) {
  try {
    const { data, error } = await supabase
      .from('algorithm_fixture_stats_cache')
      .select('statistics')
      .eq('fixture_id', Number(fixtureId))
      .maybeSingle()
    if (error) {
      if (/algorithm_fixture_stats_cache/i.test(String(error.message || ''))) return null
      throw error
    }
    if (!data) return null
    return Array.isArray(data.statistics) ? data.statistics : []
  } catch (error) {
    console.warn('algorithm fixture stats cache read skipped', error?.message || error)
    return null
  }
}

async function writeFixtureStatsCache(supabase, fixtureId, rows) {
  if (!Array.isArray(rows)) return
  try {
    await supabase.from('algorithm_fixture_stats_cache').upsert({
      fixture_id: Number(fixtureId),
      statistics: rows,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'fixture_id' })
  } catch (error) {
    console.warn('algorithm fixture stats cache write skipped', error?.message || error)
  }
}

async function fetchFixtureStatistics(supabase, fixtureId) {
  const key = String(fixtureId || '')
  if (!key) return []
  if (!fixtureStatsMemory.has(key)) {
    fixtureStatsMemory.set(key, (async () => {
      const cached = await readFixtureStatsCache(supabase, key)
      if (cached !== null) return cached
      const payload = await apiFetch(`/fixtures/statistics?fixture=${encodeURIComponent(key)}`, 12000)
      const rows = Array.isArray(payload.response) ? payload.response : []
      // Puste odpowiedzi również zapisujemy. Dzięki temu liga bez statystyk
      // nie zużywa tych samych zapytań przy każdym kolejnym skanie.
      await writeFixtureStatsCache(supabase, key, rows)
      return rows
    })())
  }
  return fixtureStatsMemory.get(key)
}

function statValue(teamRow, typeNames = []) {
  const wanted = new Set(typeNames.map(name => String(name).toLowerCase()))
  const stats = Array.isArray(teamRow?.statistics) ? teamRow.statistics : []
  const row = stats.find(item => wanted.has(String(item?.type || '').trim().toLowerCase()))
  const number = toFiniteNumber(row?.value, NaN)
  return Number.isFinite(number) ? number : null
}

function parseTeamFixtureStats(rows = [], teamId) {
  const id = String(teamId || '')
  const own = rows.find(row => String(row?.team?.id || '') === id)
  const opponent = rows.find(row => String(row?.team?.id || '') !== id)
  if (!own || !opponent) return null

  const shotsFor = statValue(own, ['Total Shots'])
  const shotsAllowed = statValue(opponent, ['Total Shots'])
  const cornersFor = statValue(own, ['Corner Kicks'])
  const cornersAllowed = statValue(opponent, ['Corner Kicks'])
  if ([shotsFor, shotsAllowed, cornersFor, cornersAllowed].some(value => value === null)) return null

  return { shotsFor, cornersFor, shotsAllowed, cornersAllowed }
}

async function readCachedTeamForm(supabase, teamId, asOfDate, sampleSize, minMatches = 1) {
  const { data, error } = await supabase
    .from('algorithm_team_form_cache')
    .select('*')
    .eq('team_id', Number(teamId))
    .eq('as_of_date', asOfDate)
    .eq('sample_size', sampleSize)
    .maybeSingle()
  if (error) {
    if (String(error.message || '').toLowerCase().includes('algorithm_team_form_cache')) return null
    throw error
  }
  if (!data || Number(data.matches_count || 0) < minMatches) return null
  return {
    teamId: Number(teamId),
    teamName: data.team_name,
    matchesCount: Number(data.matches_count || 0),
    shotsFor: Number(data.shots_for || 0),
    cornersFor: Number(data.corners_for || 0),
    shotsAllowed: Number(data.shots_allowed || 0),
    cornersAllowed: Number(data.corners_allowed || 0),
    sourceFixtureIds: Array.isArray(data.source_fixture_ids) ? data.source_fixture_ids : []
  }
}

async function writeCachedTeamForm(supabase, teamForm, asOfDate, sampleSize) {
  const row = {
    team_id: Number(teamForm.teamId),
    team_name: String(teamForm.teamName || ''),
    as_of_date: asOfDate,
    sample_size: sampleSize,
    matches_count: Number(teamForm.matchesCount || 0),
    shots_for: round(teamForm.shotsFor, 3),
    corners_for: round(teamForm.cornersFor, 3),
    shots_allowed: round(teamForm.shotsAllowed, 3),
    corners_allowed: round(teamForm.cornersAllowed, 3),
    source_fixture_ids: teamForm.sourceFixtureIds || [],
    updated_at: new Date().toISOString()
  }
  const { error } = await supabase.from('algorithm_team_form_cache').upsert(row, {
    onConflict: 'team_id,as_of_date,sample_size'
  })
  if (error) throw error
}

async function fetchTeamForm({ supabase, teamId, teamName, asOfKickoff, sampleSize, minMatches = 1, timezone }) {
  const asOfDate = dateKeyInTimezone(new Date(asOfKickoff), timezone)
  const cached = await readCachedTeamForm(supabase, teamId, asOfDate, sampleSize, minMatches)
  if (cached) return cached

  const lookback = Math.max(sampleSize + 12, 18)
  const payload = await apiFetch(`/fixtures?team=${encodeURIComponent(teamId)}&last=${lookback}&timezone=${encodeURIComponent(timezone)}`)
  const fixtures = (Array.isArray(payload.response) ? payload.response : [])
    .filter(item => FINISHED_STATUSES.has(String(item?.fixture?.status?.short || '').toUpperCase()))
    .filter(item => fixtureKickoffMs(item) > 0 && fixtureKickoffMs(item) < Date.parse(asOfKickoff))
    .sort((a, b) => fixtureKickoffMs(b) - fixtureKickoffMs(a))

  const valid = []
  let checkedStatistics = 0
  for (const fixture of fixtures) {
    if (checkedStatistics >= MAX_HISTORY_STATS_CHECKS) break
    const fixtureId = fixture?.fixture?.id
    checkedStatistics += 1
    const statistics = await fetchFixtureStatistics(supabase, fixtureId)
    const parsed = parseTeamFixtureStats(statistics, teamId)
    if (parsed) valid.push({ ...parsed, fixtureId: Number(fixtureId) })
    if (valid.length >= sampleSize) break
  }

  if (valid.length < minMatches) {
    throw new Error(`${teamName}: brak wystarczających kompletnych statystyk strzałów i rożnych (${valid.length}/${sampleSize}; sprawdzono ${checkedStatistics}).`)
  }

  const average = key => valid.reduce((sum, row) => sum + Number(row[key] || 0), 0) / valid.length
  const teamForm = {
    teamId: Number(teamId),
    teamName,
    matchesCount: valid.length,
    shotsFor: average('shotsFor'),
    cornersFor: average('cornersFor'),
    shotsAllowed: average('shotsAllowed'),
    cornersAllowed: average('cornersAllowed'),
    sourceFixtureIds: valid.map(row => row.fixtureId)
  }

  await writeCachedTeamForm(supabase, teamForm, asOfDate, sampleSize)
  return teamForm
}

function buildAlgorithmRow(fixture, odds, homeForm, awayForm, sampleSize, minProbability) {
  const model = calculatePressureModel(homeForm, awayForm)
  const selection = chooseProbabilityBet(model, {
    over: odds?.over?.best,
    under: odds?.under?.best
  }, { minProbability })
  const isBet = selection.market !== 'no_bet'
  const now = new Date().toISOString()

  return {
    fixture_id: Number(fixture.fixture.id),
    sport: 'football',
    league_id: Number(fixture?.league?.id || 0) || null,
    league_name: String(fixture?.league?.name || ''),
    country: String(fixture?.league?.country || ''),
    home_team_id: Number(fixture?.teams?.home?.id || 0) || null,
    away_team_id: Number(fixture?.teams?.away?.id || 0) || null,
    home_team: String(fixture?.teams?.home?.name || 'Gospodarze'),
    away_team: String(fixture?.teams?.away?.name || 'Goście'),
    home_logo: String(fixture?.teams?.home?.logo || ''),
    away_logo: String(fixture?.teams?.away?.logo || ''),
    kickoff: fixture?.fixture?.date || null,
    sample_size: sampleSize,
    home_matches_count: homeForm.matchesCount,
    away_matches_count: awayForm.matchesCount,
    home_shots_for: round(homeForm.shotsFor, 3),
    home_corners_for: round(homeForm.cornersFor, 3),
    home_shots_allowed: round(homeForm.shotsAllowed, 3),
    home_corners_allowed: round(homeForm.cornersAllowed, 3),
    away_shots_for: round(awayForm.shotsFor, 3),
    away_corners_for: round(awayForm.cornersFor, 3),
    away_shots_allowed: round(awayForm.shotsAllowed, 3),
    away_corners_allowed: round(awayForm.cornersAllowed, 3),
    home_attack_pressure: model.home.attackPressure,
    home_defence_pressure: model.home.defencePressure,
    away_attack_pressure: model.away.attackPressure,
    away_defence_pressure: model.away.defencePressure,
    expected_home_pressure: model.home.expectedPressure,
    expected_away_pressure: model.away.expectedPressure,
    total_pressure: model.totalPressure,
    over_probability: model.overProbability,
    under_probability: model.underProbability,
    fair_over_odds: model.fairOverOdds,
    fair_under_odds: model.fairUnderOdds,
    over_odds: odds?.over?.best || null,
    under_odds: odds?.under?.best || null,
    over_bookmaker: odds?.over?.bestBookmaker || '',
    under_bookmaker: odds?.under?.bestBookmaker || '',
    over_market_books: odds?.over?.books || 0,
    under_market_books: odds?.under?.books || 0,
    over_ev_pct: selection.overEv == null ? null : round(selection.overEv * 100, 2),
    under_ev_pct: selection.underEv == null ? null : round(selection.underEv * 100, 2),
    selected_market: selection.market,
    selected_label: selection.label,
    selected_probability: round(selection.probability, 2),
    selected_odds: round(selection.odds, 2),
    edge_pct: selection.edge == null ? null : round(selection.edge * 100, 2),
    stake: isBet ? 1 : 0,
    status: isBet ? 'pending' : 'no_bet',
    result: null,
    home_goals: null,
    away_goals: null,
    total_goals: null,
    profit: 0,
    settlement_source: null,
    settled_at: null,
    model_version: MODEL_VERSION,
    analysis_state: 'ready',
    analysis_error: '',
    analysis_attempts: 0,
    analysis_started_at: now,
    analysis_finished_at: now,
    analysis_next_retry_at: null,
    analysis_updated_at: now,
    formula_snapshot: {
      pressure_probability_points: [
        [24, 42.2], [28, 42.9], [32, 43.6], [36, 44.2],
        [40, 44.9], [44, 45.6], [48, 46.3]
      ],
      selection_rule: 'higher_probability_min_51',
      min_probability: minProbability,
      selection_reason: selection.reason,
      odds_are_informational_for_selection: true,
      odds_available_for_selected_market: Boolean(selection.hasPrice),
      prematch_only: true,
      over_consensus_odds: odds?.over?.consensus || 0,
      under_consensus_odds: odds?.under?.consensus || 0,
      home_source_fixture_ids: homeForm.sourceFixtureIds,
      away_source_fixture_ids: awayForm.sourceFixtureIds
    },
    updated_at: now
  }
}

function fixturePriority(fixture = {}, oddsMap = new Map(), existingMap = new Map()) {
  const fixtureId = String(fixture?.fixture?.id || '')
  const league = `${fixture?.league?.name || ''} ${fixture?.league?.country || ''}`.toLowerCase()
  const existing = existingMap.get(fixtureId) || {}
  const kickoff = fixtureKickoffMs(fixture)
  const minutesToKickoff = kickoff ? Math.max(0, Math.floor((kickoff - Date.now()) / 60000)) : 999999
  let score = 0

  // Najpierw najbliższe mecze. Kurs i duża liga są tylko delikatnym tie-breakerem.
  score += Math.max(0, 100000 - minutesToKickoff * 20)
  if (/world cup|mistrzostw|champions league|europa league|conference league|premier league|la liga|serie a|bundesliga|ligue 1|ekstraklasa/.test(league)) score += 1500
  if (oddsMap.has(fixtureId)) score += 300
  if (String(existing.analysis_state || '') === 'waiting_stats') score += 200
  score -= Math.min(100, Number(existing.analysis_attempts || 0)) * 10
  return score
}

function buildWaitingRow(fixture, odds, previous = {}, sampleSize = 5) {
  const now = new Date().toISOString()
  const attempts = Math.max(0, Number(previous.analysis_attempts || 0))
  return {
    fixture_id: Number(fixture?.fixture?.id),
    sport: 'football',
    league_id: Number(fixture?.league?.id || 0) || null,
    league_name: String(fixture?.league?.name || ''),
    country: String(fixture?.league?.country || ''),
    home_team_id: Number(fixture?.teams?.home?.id || 0) || null,
    away_team_id: Number(fixture?.teams?.away?.id || 0) || null,
    home_team: String(fixture?.teams?.home?.name || 'Gospodarze'),
    away_team: String(fixture?.teams?.away?.name || 'Goście'),
    home_logo: String(fixture?.teams?.home?.logo || ''),
    away_logo: String(fixture?.teams?.away?.logo || ''),
    kickoff: fixture?.fixture?.date || null,
    sample_size: sampleSize,
    over_odds: odds?.over?.best || previous.over_odds || null,
    under_odds: odds?.under?.best || previous.under_odds || null,
    over_bookmaker: odds?.over?.bestBookmaker || previous.over_bookmaker || '',
    under_bookmaker: odds?.under?.bestBookmaker || previous.under_bookmaker || '',
    over_market_books: odds?.over?.books || previous.over_market_books || 0,
    under_market_books: odds?.under?.books || previous.under_market_books || 0,
    selected_market: 'no_bet',
    selected_label: 'Trwa pobieranie statystyk',
    selected_probability: 0,
    selected_odds: 0,
    stake: 0,
    status: 'no_bet',
    model_version: MODEL_VERSION,
    analysis_state: 'waiting_stats',
    analysis_error: String(previous.analysis_error || ''),
    analysis_attempts: attempts,
    analysis_started_at: previous.analysis_started_at || null,
    analysis_finished_at: null,
    analysis_next_retry_at: previous.analysis_next_retry_at || null,
    analysis_updated_at: now,
    formula_snapshot: {
      analysis_state: 'waiting_stats',
      selection_reason: 'awaiting_team_form',
      prematch_only: true,
      odds_available: Boolean((odds?.over?.best || 0) > 1 || (odds?.under?.best || 0) > 1)
    },
    updated_at: now
  }
}

function terminalNoDataPatch(previous, message, reason = 'missing_team_form') {
  const now = new Date().toISOString()
  return {
    analysis_state: 'ready',
    analysis_error: String(message || '').slice(0, 1000),
    analysis_attempts: Number(previous?.analysis_attempts || 0) + 1,
    analysis_finished_at: now,
    analysis_next_retry_at: null,
    analysis_updated_at: now,
    selected_market: 'no_bet',
    selected_label: reason === 'started_before_analysis' ? 'Mecz rozpoczęty — pominięty' : 'Brak wystarczających statystyk',
    selected_probability: 0,
    selected_odds: 0,
    stake: 0,
    status: 'no_bet',
    formula_snapshot: {
      analysis_state: 'ready',
      selection_reason: reason,
      prematch_only: true,
      last_error: String(message || '').slice(0, 1000)
    },
    updated_at: now
  }
}

function isRateLimitError(error) {
  return Boolean(error?.isRateLimit || /429|too many requests|rate|limit|quota|requests per minute/i.test(String(error?.message || error || '')))
}

async function tryAcquireAlgorithmWorker(supabase, owner, ttlSeconds = 1020) {
  const { data, error } = await supabase.rpc('algorithm_try_acquire_worker_lock', {
    p_lock_name: 'algorithm-main-worker',
    p_owner: String(owner || 'worker'),
    p_ttl_seconds: Math.max(60, Number(ttlSeconds || 1020))
  })
  if (error) throw new Error(`Brak blokady workera V1886 w Supabase: ${error.message}`)
  return Boolean(data)
}

async function releaseAlgorithmWorker(supabase, owner) {
  const { error } = await supabase.rpc('algorithm_release_worker_lock', {
    p_lock_name: 'algorithm-main-worker',
    p_owner: String(owner || 'worker')
  })
  if (error) console.warn('algorithm worker lock release skipped', error.message)
}

async function recordAlgorithmRun(supabase, runType, status, startedAt, details = {}) {
  try {
    await supabase.from('algorithm_runs').insert({
      run_type: String(runType || 'scan'),
      status: String(status || 'success'),
      started_at: startedAt || new Date().toISOString(),
      finished_at: new Date().toISOString(),
      fixtures_loaded: Number(details.fixtures_loaded || 0),
      candidates_considered: Number(details.candidates_considered || 0),
      rows_saved: Number(details.rows_saved || 0),
      bets_saved: Number(details.bets_saved || 0),
      skipped_errors: Number(details.skipped_errors || details.errors || 0),
      details
    })
  } catch (error) {
    console.warn('algorithm_runs write skipped:', error?.message || error)
  }
}

async function generateAlgorithmPicks(options = {}) {
  const startedAt = new Date().toISOString()
  const supabase = getSupabaseAdmin()
  const timezone = String(options.timezone || process.env.APP_TIMEZONE || 'Europe/Warsaw')
  const sampleSize = Math.max(3, Math.min(10, Number(options.sampleSize || process.env.ALGORITHM_FORM_MATCHES || 5) || 5))
  const minFormMatches = Math.max(1, Math.min(sampleSize, Number(options.minFormMatches || process.env.ALGORITHM_MIN_FORM_MATCHES || 3) || 3))
  const discoveryLimit = Math.max(1, Math.min(2000, Number(options.maxFixtures || process.env.ALGORITHM_MAX_FIXTURES || 1000) || 1000))
  const processBatch = Math.max(1, Math.min(40, Number(options.processBatch || process.env.ALGORITHM_PROCESS_BATCH || 20) || 20))
  const days = Math.max(1, Math.min(3, Number(options.days || process.env.ALGORITHM_DAYS || 1) || 1))
  const minProbability = Math.max(50, Math.min(99, Number(options.minProbability ?? process.env.ALGORITHM_MIN_PROBABILITY ?? 51) || 51))
  const includeAll = options.includeAll == null ? boolEnv(process.env.ALGORITHM_INCLUDE_ALL, true) : Boolean(options.includeAll)
  const startDate = String(options.date || dateKeyInTimezone(new Date(), timezone)).slice(0, 10)
  const minLeadMinutes = Math.max(1, Number(options.minLeadMinutes || PREMATCH_MIN_LEAD_MINUTES) || PREMATCH_MIN_LEAD_MINUTES)
  const maxRuntimeMs = Math.max(60_000, Math.min(13 * 60_000, Number(options.maxRuntimeMs || process.env.ALGORITHM_MAX_RUNTIME_MS || 11 * 60_000) || 11 * 60_000))
  const runDeadline = Date.now() + maxRuntimeMs
  const prematchCutoffMs = Date.now() + minLeadMinutes * 60_000
  const prematchCutoffIso = new Date(prematchCutoffMs).toISOString()

  try {
    // Rekordy, których nie udało się policzyć przed rozpoczęciem, kończymy bez typu.
    // Nie odpytujemy API dla meczu rozpoczętego ani live.
    const expiredPatch = terminalNoDataPatch({}, 'Mecz rozpoczął się przed zakończeniem analizy. Algorytm działa wyłącznie pre-match.', 'started_before_analysis')
    const { data: expiredRows, error: expiredError } = await supabase
      .from('algorithm_bets')
      .update(expiredPatch)
      .eq('analysis_state', 'waiting_stats')
      .lte('kickoff', prematchCutoffIso)
      .select('fixture_id')
    if (expiredError) throw expiredError

    const fixtures = []
    const oddsRows = []
    const scanWarnings = []
    for (let offset = 0; offset < days; offset += 1) {
      const date = shiftDateKey(startDate, offset)
      const dayFixtures = await fetchFixturesForDate(date, timezone)
      fixtures.push(...dayFixtures)
      try {
        const dayOdds = await fetchOddsForDate(date, options.oddsMaxPages)
        oddsRows.push(...dayOdds)
      } catch (error) {
        scanWarnings.push(`Kursy ${date}: ${String(error?.message || error)}`)
      }
    }

    const oddsMap = buildOverUnderOddsMap(oddsRows)
    const allCandidates = fixtures
      .filter(fixture => UPCOMING_STATUSES.has(String(fixture?.fixture?.status?.short || '').toUpperCase()))
      .filter(fixture => fixtureKickoffMs(fixture) > prematchCutoffMs)
      .filter(fixture => includeAll || !isExcludedFixture(fixture))
      .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))
      .slice(0, discoveryLimit)

    const candidateIds = allCandidates.map(item => Number(item?.fixture?.id)).filter(Boolean)
    const existingMap = new Map()
    if (candidateIds.length) {
      for (const idBatch of chunk(candidateIds, 100)) {
        const { data, error } = await supabase
          .from('algorithm_bets')
          .select('fixture_id,status,updated_at,over_odds,under_odds,over_bookmaker,under_bookmaker,over_market_books,under_market_books,selected_odds,selected_market,analysis_state,analysis_error,analysis_attempts,analysis_started_at,analysis_finished_at,analysis_next_retry_at')
          .in('fixture_id', idBatch)
        if (error) throw error
        ;(data || []).forEach(row => existingMap.set(String(row.fixture_id), row))
      }
    }

    // Każdy przyszły mecz trafia od razu do kolejki i jest widoczny w dashboardzie.
    const waitingRows = allCandidates
      .filter(fixture => !existingMap.has(String(fixture?.fixture?.id || '')))
      .map(fixture => buildWaitingRow(fixture, oddsMap.get(String(fixture?.fixture?.id || '')) || {}, {}, sampleSize))
    if (waitingRows.length) {
      for (const rowBatch of chunk(waitingRows, 100)) {
        const { error } = await supabase.from('algorithm_bets').upsert(rowBatch, {
          onConflict: 'fixture_id',
          ignoreDuplicates: true
        })
        if (error) throw error
      }
      waitingRows.forEach(row => existingMap.set(String(row.fixture_id), row))
    }

    // Dla gotowych typów aktualizujemy kurs tylko wtedy, gdy mecz nadal jest pre-match.
    let oddsRefreshed = 0
    for (const fixture of allCandidates) {
      const fixtureId = String(fixture?.fixture?.id || '')
      const existing = existingMap.get(fixtureId)
      const fresh = oddsMap.get(fixtureId)
      if (!existing || !fresh || String(existing.analysis_state || 'ready') !== 'ready') continue
      if (!['over_2_5', 'under_2_5'].includes(String(existing.selected_market || ''))) continue
      const effective = mergeOddsSnapshot(fresh, oddsFromExistingBet(existing))
      const selectedMarket = String(existing.selected_market || '')
      const selectedOdds = selectedMarket === 'over_2_5' ? effective.over.best : effective.under.best
      const { error } = await supabase.from('algorithm_bets').update({
        over_odds: effective.over.best || null,
        under_odds: effective.under.best || null,
        over_bookmaker: effective.over.bestBookmaker || '',
        under_bookmaker: effective.under.bestBookmaker || '',
        over_market_books: effective.over.books || 0,
        under_market_books: effective.under.books || 0,
        selected_odds: selectedOdds || 0,
        updated_at: new Date().toISOString()
      }).eq('fixture_id', Number(fixtureId))
      if (!error) oddsRefreshed += 1
    }

    const nowIso = new Date().toISOString()
    const processCandidates = allCandidates
      .filter(fixture => {
        const existing = existingMap.get(String(fixture?.fixture?.id || '')) || {}
        if (SETTLED_STATUSES.has(String(existing.status || ''))) return false
        if (String(existing.analysis_state || 'waiting_stats') === 'ready') return false
        const retryAt = Date.parse(existing.analysis_next_retry_at || '')
        if (Number.isFinite(retryAt) && retryAt > Date.now()) return false
        return fixtureKickoffMs(fixture) > Date.now() + minLeadMinutes * 60_000
      })
      .sort((a, b) => fixturePriority(b, oddsMap, existingMap) - fixturePriority(a, oddsMap, existingMap))
      .slice(0, processBatch)

    const errors = []
    const savedRows = []
    let stoppedForRateLimit = false
    let stoppedForRuntime = false

    for (const fixture of processCandidates) {
      if (Date.now() >= runDeadline) {
        stoppedForRuntime = true
        break
      }

      const fixtureId = String(fixture?.fixture?.id || '')
      const kickoff = fixture?.fixture?.date
      const homeId = fixture?.teams?.home?.id
      const awayId = fixture?.teams?.away?.id
      const previous = existingMap.get(fixtureId) || {}
      if (!fixtureId || !kickoff || !homeId || !awayId) continue

      // Twarda kontrola tuż przed pobieraniem: żadnych rozpoczętych spotkań.
      if (Date.parse(kickoff) <= Date.now() + minLeadMinutes * 60_000 || !UPCOMING_STATUSES.has(String(fixture?.fixture?.status?.short || '').toUpperCase())) {
        const patch = terminalNoDataPatch(previous, 'Mecz nie jest już dostępny pre-match.', 'started_before_analysis')
        await supabase.from('algorithm_bets').update(patch).eq('fixture_id', Number(fixtureId))
        continue
      }

      const analysisStartedAt = new Date().toISOString()
      await supabase.from('algorithm_bets').update({
        analysis_started_at: analysisStartedAt,
        analysis_next_retry_at: null,
        analysis_updated_at: analysisStartedAt,
        updated_at: analysisStartedAt
      }).eq('fixture_id', Number(fixtureId))

      try {
        // Celowo sekwencyjnie. Globalny limiter utrzymuje maks. ~3 zapytania/s
        // i nie pozwala przekroczyć limitu planu Pro 5/s.
        const homeForm = await fetchTeamForm({
          supabase,
          teamId: homeId,
          teamName: fixture?.teams?.home?.name,
          asOfKickoff: kickoff,
          sampleSize,
          minMatches: minFormMatches,
          timezone
        })
        const awayForm = await fetchTeamForm({
          supabase,
          teamId: awayId,
          teamName: fixture?.teams?.away?.name,
          asOfKickoff: kickoff,
          sampleSize,
          minMatches: minFormMatches,
          timezone
        })

        const previousOdds = oddsFromExistingBet(previous)
        let freshOdds = oddsMap.get(fixtureId) || null
        if (!freshOdds && Date.now() < runDeadline - 15_000) freshOdds = await fetchOddsForFixture(fixtureId)
        const effectiveOdds = mergeOddsSnapshot(freshOdds || {}, previousOdds)
        const row = buildAlgorithmRow(fixture, effectiveOdds, homeForm, awayForm, sampleSize, minProbability)
        row.analysis_attempts = Number(previous.analysis_attempts || 0) + 1
        row.analysis_started_at = analysisStartedAt
        row.analysis_finished_at = new Date().toISOString()
        row.analysis_next_retry_at = null

        const { error } = await supabase.from('algorithm_bets').upsert(row, { onConflict: 'fixture_id' })
        if (error) throw error
        savedRows.push(row)
        existingMap.set(fixtureId, row)
      } catch (error) {
        const message = String(error?.message || error)
        const rateLimited = isRateLimitError(error)
        const attempts = Number(previous.analysis_attempts || 0) + 1
        const isMissingStats = /brak wystarczających kompletnych statystyk/i.test(message)
        errors.push({
          fixture_id: Number(fixtureId),
          match: `${fixture?.teams?.home?.name || ''} - ${fixture?.teams?.away?.name || ''}`,
          error: message
        })

        if (isMissingStats && attempts >= MAX_MISSING_DATA_ATTEMPTS) {
          const patch = terminalNoDataPatch(previous, message, 'missing_team_form_final')
          patch.analysis_attempts = attempts
          await supabase.from('algorithm_bets').update(patch).eq('fixture_id', Number(fixtureId))
          existingMap.set(fixtureId, { ...previous, ...patch })
          continue
        }

        const retryDelayMs = rateLimited ? API_RATE_LIMIT_RETRY_MS : 15 * 60_000
        const patch = {
          analysis_state: 'waiting_stats',
          analysis_error: message.slice(0, 1000),
          analysis_attempts: attempts,
          analysis_finished_at: new Date().toISOString(),
          analysis_next_retry_at: new Date(Date.now() + retryDelayMs).toISOString(),
          analysis_updated_at: new Date().toISOString(),
          formula_snapshot: {
            analysis_state: 'waiting_stats',
            selection_reason: rateLimited ? 'api_rate_limit_retry' : 'missing_team_form_retry',
            prematch_only: true,
            last_error: message.slice(0, 1000),
            attempts
          },
          updated_at: new Date().toISOString()
        }
        await supabase.from('algorithm_bets').update(patch).eq('fixture_id', Number(fixtureId))
        existingMap.set(fixtureId, { ...previous, ...patch })

        if (rateLimited) {
          stoppedForRateLimit = true
          break
        }
      }
    }

    const result = {
      ok: true,
      model_version: MODEL_VERSION,
      selection_rule: 'higher_probability_min_51',
      prematch_only: true,
      prematch_min_lead_minutes: minLeadMinutes,
      date_from: startDate,
      days,
      sample_size: sampleSize,
      min_form_matches: minFormMatches,
      min_probability: minProbability,
      include_all_competitions: includeAll,
      fixtures_loaded: fixtures.length,
      fixtures_discovered: allCandidates.length,
      fixtures_with_ou25_odds: oddsMap.size,
      waiting_rows_inserted: waitingRows.length,
      expired_before_analysis: Array.isArray(expiredRows) ? expiredRows.length : 0,
      odds_refreshed: oddsRefreshed,
      candidates_considered: processCandidates.length,
      process_batch: processBatch,
      rows_saved: savedRows.length,
      bets_saved: savedRows.filter(row => row.selected_market !== 'no_bet').length,
      bets_without_selected_odds: savedRows.filter(row => row.selected_market !== 'no_bet' && Number(row.selected_odds || 0) <= 1).length,
      no_bet_saved: savedRows.filter(row => row.selected_market === 'no_bet').length,
      over_saved: savedRows.filter(row => row.selected_market === 'over_2_5').length,
      under_saved: savedRows.filter(row => row.selected_market === 'under_2_5').length,
      stopped_for_rate_limit: stoppedForRateLimit,
      stopped_for_runtime: stoppedForRuntime,
      skipped_errors: errors.length,
      warnings: scanWarnings.slice(0, 50),
      errors: errors.slice(0, 50),
      finished_at: new Date().toISOString()
    }
    await recordAlgorithmRun(supabase, 'scan', errors.length ? 'partial' : 'success', startedAt, result)
    return result
  } catch (error) {
    const details = { ok: false, prematch_only: true, error: String(error?.message || error) }
    await recordAlgorithmRun(supabase, 'scan', 'error', startedAt, details)
    throw error
  }
}

module.exports = {
  MODEL_VERSION,
  generateAlgorithmPicks,
  recordAlgorithmRun,
  getSupabaseAdmin,
  getApiKey,
  apiFetch,
  dateKeyInTimezone,
  shiftDateKey,
  buildOverUnderOddsMap,
  oddsFromExistingBet,
  mergeOddsSnapshot,
  fetchTeamForm,
  parseTeamFixtureStats,
  tryAcquireAlgorithmWorker,
  releaseAlgorithmWorker,
  PREMATCH_MIN_LEAD_MINUTES
}
