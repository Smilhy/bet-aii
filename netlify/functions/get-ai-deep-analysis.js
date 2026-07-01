const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}

function clean(value, fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}

function number(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function pct(value) {
  const n = number(String(value == null ? '' : value).replace('%', ''), 0)
  return Math.max(0, Math.min(100, Math.round(n)))
}

async function apiGet(path, query = {}) {
  if (!API_KEY) return { ok: false, data: [], error: 'Brak klucza API-Football' }
  const url = new URL(`https://v3.football.api-sports.io${path}`)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value))
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8500)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'x-apisports-key': API_KEY } })
    const payload = await response.json().catch(() => ({}))
    const errors = payload?.errors && typeof payload.errors === 'object' ? payload.errors : null
    if (!response.ok || (errors && Object.keys(errors).length)) {
      return { ok: false, data: [], error: errors && Object.keys(errors).length ? JSON.stringify(errors) : `HTTP ${response.status}` }
    }
    return { ok: true, data: Array.isArray(payload?.response) ? payload.response : [], error: '' }
  } catch (error) {
    return { ok: false, data: [], error: error?.name === 'AbortError' ? 'Przekroczono czas API' : clean(error?.message, 'Błąd API') }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeComparison(comparison = {}) {
  const labels = {
    form: 'Forma', att: 'Atak', def: 'Obrona', poisson_distribution: 'Model Poissona',
    h2h: 'Mecze H2H', goals: 'Bramki', total: 'Ocena łączna'
  }
  return Object.entries(comparison || {}).map(([key, value]) => ({
    key,
    label: labels[key] || key,
    home: pct(value?.home),
    away: pct(value?.away)
  })).filter(row => row.home || row.away)
}

function normalizeLastFive(node = {}) {
  return {
    form: pct(node?.form),
    attack: pct(node?.att),
    defence: pct(node?.def),
    goalsFor: number(node?.goals?.for?.average ?? node?.goals?.for?.total, 0),
    goalsAgainst: number(node?.goals?.against?.average ?? node?.goals?.against?.total, 0)
  }
}

function normalizePrediction(row = {}) {
  const predictions = row?.predictions || {}
  return {
    available: Boolean(row && Object.keys(row).length),
    advice: clean(predictions?.advice),
    winner: clean(predictions?.winner?.name),
    winnerComment: clean(predictions?.winner?.comment),
    winOrDraw: Boolean(predictions?.win_or_draw),
    underOver: clean(predictions?.under_over),
    goals: {
      home: clean(predictions?.goals?.home),
      away: clean(predictions?.goals?.away)
    },
    percent: {
      home: pct(predictions?.percent?.home),
      draw: pct(predictions?.percent?.draw),
      away: pct(predictions?.percent?.away)
    },
    comparison: normalizeComparison(row?.comparison || {}),
    lastFive: {
      home: normalizeLastFive(row?.teams?.home?.last_5 || {}),
      away: normalizeLastFive(row?.teams?.away?.last_5 || {})
    },
    leagueForm: {
      home: clean(row?.teams?.home?.league?.form),
      away: clean(row?.teams?.away?.league?.form)
    }
  }
}

function normalizeFixture(row = {}) {
  return {
    available: Boolean(row && Object.keys(row).length),
    id: clean(row?.fixture?.id),
    date: clean(row?.fixture?.date),
    timestamp: number(row?.fixture?.timestamp, 0),
    referee: clean(row?.fixture?.referee),
    venue: clean(row?.fixture?.venue?.name),
    city: clean(row?.fixture?.venue?.city),
    timezone: clean(row?.fixture?.timezone),
    status: clean(row?.fixture?.status?.long || row?.fixture?.status?.short),
    round: clean(row?.league?.round),
    season: number(row?.league?.season, 0),
    leagueId: clean(row?.league?.id),
    league: clean(row?.league?.name),
    country: clean(row?.league?.country),
    home: {
      id: clean(row?.teams?.home?.id),
      name: clean(row?.teams?.home?.name),
      logo: clean(row?.teams?.home?.logo)
    },
    away: {
      id: clean(row?.teams?.away?.id),
      name: clean(row?.teams?.away?.name),
      logo: clean(row?.teams?.away?.logo)
    }
  }
}

function normalizeH2H(rows = [], homeId, awayId) {
  let homeWins = 0
  let draws = 0
  let awayWins = 0
  let goals = 0
  let btts = 0
  let over25 = 0
  const matches = (rows || []).slice(0, 8).map(row => {
    const hg = number(row?.goals?.home, 0)
    const ag = number(row?.goals?.away, 0)
    goals += hg + ag
    if (hg > 0 && ag > 0) btts += 1
    if (hg + ag > 2.5) over25 += 1
    const rowHomeId = String(row?.teams?.home?.id || '')
    const rowAwayId = String(row?.teams?.away?.id || '')
    const selectedHomeWasHome = rowHomeId === String(homeId || '')
    const selectedHomeGoals = selectedHomeWasHome ? hg : ag
    const selectedAwayGoals = selectedHomeWasHome ? ag : hg
    if (selectedHomeGoals > selectedAwayGoals) homeWins += 1
    else if (selectedHomeGoals < selectedAwayGoals) awayWins += 1
    else draws += 1
    return {
      date: clean(row?.fixture?.date),
      league: clean(row?.league?.name),
      home: clean(row?.teams?.home?.name),
      away: clean(row?.teams?.away?.name),
      homeGoals: hg,
      awayGoals: ag
    }
  })
  const count = matches.length
  return {
    available: count > 0,
    matches,
    summary: {
      count,
      homeWins,
      draws,
      awayWins,
      avgGoals: count ? Math.round((goals / count) * 100) / 100 : 0,
      bttsPct: count ? Math.round((btts / count) * 100) : 0,
      over25Pct: count ? Math.round((over25 / count) * 100) : 0
    }
  }
}

function normalizeInjuries(rows = [], homeId, awayId) {
  const items = (rows || []).slice(0, 20).map(row => ({
    teamId: clean(row?.team?.id),
    team: clean(row?.team?.name),
    player: clean(row?.player?.name),
    type: clean(row?.player?.type),
    reason: clean(row?.player?.reason)
  }))
  return {
    available: items.length > 0,
    homeCount: items.filter(item => item.teamId === String(homeId || '')).length,
    awayCount: items.filter(item => item.teamId === String(awayId || '')).length,
    items
  }
}

function findStanding(rows = [], teamId) {
  const leagues = rows?.[0]?.league?.standings || []
  const flattened = Array.isArray(leagues) ? leagues.flat() : []
  const row = flattened.find(item => String(item?.team?.id || '') === String(teamId || ''))
  if (!row) return null
  return {
    rank: number(row?.rank, 0),
    points: number(row?.points, 0),
    goalsDiff: number(row?.goalsDiff, 0),
    form: clean(row?.form),
    played: number(row?.all?.played, 0),
    wins: number(row?.all?.win, 0),
    draws: number(row?.all?.draw, 0),
    losses: number(row?.all?.lose, 0),
    goalsFor: number(row?.all?.goals?.for, 0),
    goalsAgainst: number(row?.all?.goals?.against, 0)
  }
}

async function findStoredTip(fixtureId, market, prediction) {
  if (!SUPABASE_URL || !SERVICE_KEY || !fixtureId) return null
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const columns = '*'
    const fields = ['external_fixture_id', 'fixture_id', 'api_fixture_id']
    for (const field of fields) {
      let query = supabase.from('tips').select(columns).eq(field, fixtureId).order('created_at', { ascending: false }).limit(10)
      const { data, error } = await query
      if (error) continue
      const rows = data || []
      const exact = rows.find(row => {
        const rowMarket = clean(row?.market || row?.bet_type).toLowerCase()
        const rowPrediction = clean(row?.prediction || row?.selection || row?.pick).toLowerCase()
        return (!market || rowMarket === clean(market).toLowerCase()) && (!prediction || rowPrediction === clean(prediction).toLowerCase())
      })
      if (exact) return exact
      if (rows[0]) return rows[0]
    }
  } catch (_) {}
  return null
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const params = event.queryStringParameters || {}
  const fixtureId = clean(params.fixture || params.fixture_id).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  const market = clean(params.market).slice(0, 180)
  const predictionText = clean(params.prediction).slice(0, 240)
  if (!fixtureId) return json(400, { error: 'Brak fixture id' })

  const storedTipPromise = findStoredTip(fixtureId, market, predictionText)
  const fixtureResponse = await apiGet('/fixtures', { id: fixtureId })
  const fixtureRow = fixtureResponse.data?.[0] || null
  const fixture = normalizeFixture(fixtureRow || {})

  const parallel = [
    apiGet('/predictions', { fixture: fixtureId }),
    apiGet('/injuries', { fixture: fixtureId })
  ]
  if (fixture.home.id && fixture.away.id) parallel.push(apiGet('/fixtures/headtohead', { h2h: `${fixture.home.id}-${fixture.away.id}`, last: 8 }))
  else parallel.push(Promise.resolve({ ok: false, data: [], error: 'Brak ID drużyn' }))
  if (fixture.leagueId && fixture.season) parallel.push(apiGet('/standings', { league: fixture.leagueId, season: fixture.season }))
  else parallel.push(Promise.resolve({ ok: false, data: [], error: 'Brak ligi lub sezonu' }))

  const [predictionResponse, injuriesResponse, h2hResponse, standingsResponse] = await Promise.all(parallel)
  const storedTip = await storedTipPromise
  const prediction = normalizePrediction(predictionResponse.data?.[0] || {})
  const h2h = normalizeH2H(h2hResponse.data || [], fixture.home.id, fixture.away.id)
  const injuries = normalizeInjuries(injuriesResponse.data || [], fixture.home.id, fixture.away.id)
  const standings = {
    available: Boolean(standingsResponse.data?.length),
    home: findStanding(standingsResponse.data || [], fixture.home.id),
    away: findStanding(standingsResponse.data || [], fixture.away.id)
  }

  const errors = [
    fixtureResponse.ok ? '' : `Mecz: ${fixtureResponse.error}`,
    predictionResponse.ok ? '' : `Prognoza: ${predictionResponse.error}`,
    h2hResponse.ok ? '' : `H2H: ${h2hResponse.error}`,
    injuriesResponse.ok ? '' : `Absencje: ${injuriesResponse.error}`,
    standingsResponse.ok ? '' : `Tabela: ${standingsResponse.error}`
  ].filter(Boolean)

  return json(200, {
    ok: true,
    fixtureId,
    generatedAt: new Date().toISOString(),
    storedTip,
    fixture,
    prediction,
    h2h,
    injuries,
    standings,
    apiAvailable: Boolean(API_KEY),
    partial: errors.length > 0,
    errors
  })
}
