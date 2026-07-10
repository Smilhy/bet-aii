const { createClient } = require('@supabase/supabase-js')
const {
  calculatePressureModel,
  chooseValueBet,
  round,
  toFiniteNumber
} = require('./algorithm-model')

const API_BASE = 'https://v3.football.api-sports.io'
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
const UPCOMING_STATUSES = new Set(['NS', 'TBD'])

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

function median(values = []) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return 0
  const middle = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2
}

async function apiFetch(path, timeoutMs = 14000) {
  const key = getApiKey()
  if (!key) throw new Error('Brak APISPORTS_KEY / API_FOOTBALL_KEY w Netlify.')
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
      throw new Error(`API-Football ${response.status}: ${errors ? JSON.stringify(errors) : text.slice(0, 240)}`)
    }
    return payload || {}
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchFixturesForDate(date, timezone) {
  const payload = await apiFetch(`/fixtures?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`)
  return Array.isArray(payload.response) ? payload.response : []
}

async function fetchOddsForDate(date, maxPages = 5) {
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
    if (!prices.over.length || !prices.under.length) return
    const summarize = list => {
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

async function fetchFixtureStatistics(fixtureId) {
  const key = String(fixtureId || '')
  if (!key) return []
  if (!fixtureStatsMemory.has(key)) {
    fixtureStatsMemory.set(key, apiFetch(`/fixtures/statistics?fixture=${encodeURIComponent(key)}`, 12000)
      .then(payload => Array.isArray(payload.response) ? payload.response : [])
      .catch(() => []))
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

async function readCachedTeamForm(supabase, teamId, asOfDate, sampleSize) {
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
  if (!data || Number(data.matches_count || 0) < Math.min(3, sampleSize)) return null
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

async function fetchTeamForm({ supabase, teamId, teamName, asOfKickoff, sampleSize, timezone }) {
  const asOfDate = dateKeyInTimezone(new Date(asOfKickoff), timezone)
  const cached = await readCachedTeamForm(supabase, teamId, asOfDate, sampleSize)
  if (cached) return cached

  const lookback = Math.max(sampleSize + 8, 15)
  const payload = await apiFetch(`/fixtures?team=${encodeURIComponent(teamId)}&last=${lookback}&timezone=${encodeURIComponent(timezone)}`)
  const fixtures = (Array.isArray(payload.response) ? payload.response : [])
    .filter(item => FINISHED_STATUSES.has(String(item?.fixture?.status?.short || '').toUpperCase()))
    .filter(item => fixtureKickoffMs(item) > 0 && fixtureKickoffMs(item) < Date.parse(asOfKickoff))
    .sort((a, b) => fixtureKickoffMs(b) - fixtureKickoffMs(a))
    .slice(0, sampleSize)

  const perMatch = await mapConcurrent(fixtures, 2, async fixture => {
    const fixtureId = fixture?.fixture?.id
    const statistics = await fetchFixtureStatistics(fixtureId)
    const parsed = parseTeamFixtureStats(statistics, teamId)
    return parsed ? { ...parsed, fixtureId: Number(fixtureId) } : null
  })

  const valid = perMatch.filter(Boolean)
  if (valid.length < Math.min(3, sampleSize)) {
    throw new Error(`${teamName}: za mało kompletnych meczów ze strzałami i rożnymi (${valid.length}/${sampleSize}).`)
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

function buildAlgorithmRow(fixture, odds, homeForm, awayForm, sampleSize, minEdge) {
  const model = calculatePressureModel(homeForm, awayForm)
  const selection = chooseValueBet(model, {
    over: odds.over.best,
    under: odds.under.best
  }, { minEdge })
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
    over_odds: odds.over.best,
    under_odds: odds.under.best,
    over_bookmaker: odds.over.bestBookmaker,
    under_bookmaker: odds.under.bestBookmaker,
    over_market_books: odds.over.books,
    under_market_books: odds.under.books,
    over_ev_pct: selection.overEv == null ? null : round(selection.overEv * 100, 2),
    under_ev_pct: selection.underEv == null ? null : round(selection.underEv * 100, 2),
    selected_market: selection.market,
    selected_label: selection.label,
    selected_probability: round(selection.probability, 2),
    selected_odds: round(selection.odds, 2),
    edge_pct: selection.edge == null ? null : round(selection.edge * 100, 2),
    stake: isBet ? 1 : 0,
    status: isBet ? 'pending' : 'no_bet',
    profit: 0,
    model_version: 'pressure-ou25-v1',
    formula_snapshot: {
      pressure_probability_points: [
        [24, 42.2], [28, 42.9], [32, 43.6], [36, 44.2],
        [40, 44.9], [44, 45.6], [48, 46.3]
      ],
      min_edge: minEdge,
      home_source_fixture_ids: homeForm.sourceFixtureIds,
      away_source_fixture_ids: awayForm.sourceFixtureIds
    },
    updated_at: now
  }
}

async function generateAlgorithmPicks(options = {}) {
  const supabase = getSupabaseAdmin()
  const timezone = String(options.timezone || process.env.APP_TIMEZONE || 'Europe/Warsaw')
  const sampleSize = Math.max(3, Math.min(10, Number(options.sampleSize || process.env.ALGORITHM_FORM_MATCHES || 5) || 5))
  const maxFixtures = Math.max(1, Math.min(40, Number(options.maxFixtures || process.env.ALGORITHM_MAX_FIXTURES || 12) || 12))
  const days = Math.max(1, Math.min(3, Number(options.days || 2) || 2))
  const minEdge = Math.max(-0.5, Math.min(1, Number(options.minEdge ?? process.env.ALGORITHM_MIN_EDGE ?? 0) || 0))
  const force = Boolean(options.force)
  const startDate = String(options.date || dateKeyInTimezone(new Date(), timezone)).slice(0, 10)
  const nowMs = Date.now()

  const fixtures = []
  const oddsRows = []
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftDateKey(startDate, offset)
    const [dateFixtures, dateOdds] = await Promise.all([
      fetchFixturesForDate(date, timezone),
      fetchOddsForDate(date)
    ])
    fixtures.push(...dateFixtures)
    oddsRows.push(...dateOdds)
  }

  const oddsMap = buildOverUnderOddsMap(oddsRows)
  let candidates = fixtures
    .filter(fixture => UPCOMING_STATUSES.has(String(fixture?.fixture?.status?.short || '').toUpperCase()))
    .filter(fixture => fixtureKickoffMs(fixture) > nowMs - 15 * 60 * 1000)
    .filter(fixture => !isExcludedFixture(fixture))
    .filter(fixture => oddsMap.has(String(fixture?.fixture?.id || '')))
    .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))

  const candidateIds = candidates.map(item => Number(item?.fixture?.id)).filter(Boolean)
  const existingMap = new Map()
  if (candidateIds.length) {
    const { data, error } = await supabase
      .from('algorithm_bets')
      .select('fixture_id,status')
      .in('fixture_id', candidateIds)
    if (error) throw error
    ;(data || []).forEach(row => existingMap.set(String(row.fixture_id), String(row.status || '')))
  }

  candidates = candidates
    .filter(fixture => {
      const status = existingMap.get(String(fixture?.fixture?.id || ''))
      if (!status) return true
      if (['won', 'lost', 'void'].includes(status)) return false
      return force
    })
    .slice(0, maxFixtures)

  const errors = []
  const generated = await mapConcurrent(candidates, 2, async fixture => {
    const fixtureId = String(fixture?.fixture?.id || '')
    const kickoff = fixture?.fixture?.date
    const homeId = fixture?.teams?.home?.id
    const awayId = fixture?.teams?.away?.id
    if (!fixtureId || !kickoff || !homeId || !awayId) return null
    try {
      const [homeForm, awayForm] = await Promise.all([
        fetchTeamForm({
          supabase,
          teamId: homeId,
          teamName: fixture?.teams?.home?.name,
          asOfKickoff: kickoff,
          sampleSize,
          timezone
        }),
        fetchTeamForm({
          supabase,
          teamId: awayId,
          teamName: fixture?.teams?.away?.name,
          asOfKickoff: kickoff,
          sampleSize,
          timezone
        })
      ])
      return buildAlgorithmRow(fixture, oddsMap.get(fixtureId), homeForm, awayForm, sampleSize, minEdge)
    } catch (error) {
      errors.push({
        fixture_id: Number(fixtureId),
        match: `${fixture?.teams?.home?.name || ''} - ${fixture?.teams?.away?.name || ''}`,
        error: String(error?.message || error)
      })
      return null
    }
  })

  const rows = generated.filter(Boolean)
  if (rows.length) {
    const { error } = await supabase.from('algorithm_bets').upsert(rows, { onConflict: 'fixture_id' })
    if (error) throw error
  }

  return {
    ok: true,
    model_version: 'pressure-ou25-v1',
    date_from: startDate,
    days,
    sample_size: sampleSize,
    min_edge_pct: round(minEdge * 100, 2),
    fixtures_loaded: fixtures.length,
    fixtures_with_ou25_odds: oddsMap.size,
    candidates_considered: candidates.length,
    rows_saved: rows.length,
    bets_saved: rows.filter(row => row.selected_market !== 'no_bet').length,
    no_bet_saved: rows.filter(row => row.selected_market === 'no_bet').length,
    skipped_errors: errors.length,
    errors: errors.slice(0, 20)
  }
}

module.exports = {
  generateAlgorithmPicks,
  getSupabaseAdmin,
  getApiKey,
  apiFetch,
  dateKeyInTimezone,
  shiftDateKey,
  buildOverUnderOddsMap,
  fetchTeamForm,
  parseTeamFixtureStats
}
