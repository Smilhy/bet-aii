const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=180, stale-while-revalidate=420',
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

function num(value, fallback = 0) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.').replace('%', ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function pct(value) {
  return Math.max(0, Math.min(100, Math.round(num(value, 0))))
}

async function apiGet(path, query = {}) {
  if (!API_KEY) return { ok: false, data: [], error: 'Brak klucza API-Football' }
  const url = new URL(`https://v3.football.api-sports.io${path}`)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value))
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)
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
    clearTimeout(timer)
  }
}

function normalizeFixture(row = {}) {
  return {
    id: clean(row?.fixture?.id),
    date: clean(row?.fixture?.date),
    timestamp: num(row?.fixture?.timestamp),
    referee: clean(row?.fixture?.referee),
    venue: clean(row?.fixture?.venue?.name),
    city: clean(row?.fixture?.venue?.city),
    status: clean(row?.fixture?.status?.long || row?.fixture?.status?.short),
    statusShort: clean(row?.fixture?.status?.short),
    round: clean(row?.league?.round),
    leagueId: clean(row?.league?.id),
    league: clean(row?.league?.name),
    country: clean(row?.league?.country),
    season: num(row?.league?.season),
    home: { id: clean(row?.teams?.home?.id), name: clean(row?.teams?.home?.name), logo: clean(row?.teams?.home?.logo) },
    away: { id: clean(row?.teams?.away?.id), name: clean(row?.teams?.away?.name), logo: clean(row?.teams?.away?.logo) }
  }
}

function normalizeLastFive(node = {}) {
  return {
    form: pct(node?.form),
    attack: pct(node?.att),
    defence: pct(node?.def),
    goalsFor: num(node?.goals?.for?.average ?? node?.goals?.for?.total, 0),
    goalsAgainst: num(node?.goals?.against?.average ?? node?.goals?.against?.total, 0)
  }
}

function normalizePrediction(row = {}) {
  const predictions = row?.predictions || {}
  const comparison = row?.comparison || {}
  return {
    available: Boolean(row && Object.keys(row).length),
    advice: clean(predictions?.advice),
    winner: clean(predictions?.winner?.name),
    winnerComment: clean(predictions?.winner?.comment),
    underOver: clean(predictions?.under_over),
    percent: {
      home: pct(predictions?.percent?.home),
      draw: pct(predictions?.percent?.draw),
      away: pct(predictions?.percent?.away)
    },
    comparison: {
      form: { home: pct(comparison?.form?.home), away: pct(comparison?.form?.away) },
      attack: { home: pct(comparison?.att?.home), away: pct(comparison?.att?.away) },
      defence: { home: pct(comparison?.def?.home), away: pct(comparison?.def?.away) },
      poisson: { home: pct(comparison?.poisson_distribution?.home), away: pct(comparison?.poisson_distribution?.away) },
      h2h: { home: pct(comparison?.h2h?.home), away: pct(comparison?.h2h?.away) },
      goals: { home: pct(comparison?.goals?.home), away: pct(comparison?.goals?.away) },
      total: { home: pct(comparison?.total?.home), away: pct(comparison?.total?.away) }
    },
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

function normalizeH2H(rows = [], selectedHomeId, selectedAwayId) {
  let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0, btts = 0, over25 = 0
  const matches = (rows || []).slice(0, 8).map(row => {
    const hg = num(row?.goals?.home), ag = num(row?.goals?.away)
    const rowHome = String(row?.teams?.home?.id || '')
    const selectedHomeWasHome = rowHome === String(selectedHomeId || '')
    const shg = selectedHomeWasHome ? hg : ag
    const sag = selectedHomeWasHome ? ag : hg
    if (shg > sag) homeWins += 1
    else if (shg < sag) awayWins += 1
    else draws += 1
    totalGoals += hg + ag
    if (hg > 0 && ag > 0) btts += 1
    if (hg + ag >= 3) over25 += 1
    return {
      date: clean(row?.fixture?.date),
      league: clean(row?.league?.name),
      home: clean(row?.teams?.home?.name), away: clean(row?.teams?.away?.name),
      homeGoals: hg, awayGoals: ag
    }
  })
  const count = matches.length
  return {
    available: count > 0,
    matches,
    summary: {
      count, homeWins, draws, awayWins,
      avgGoals: count ? Math.round((totalGoals / count) * 100) / 100 : 0,
      bttsPct: count ? Math.round((btts / count) * 100) : 0,
      over25Pct: count ? Math.round((over25 / count) * 100) : 0
    }
  }
}

function normalizeInjuries(rows = [], homeId, awayId) {
  const items = (rows || []).slice(0, 40).map(row => ({
    teamId: clean(row?.team?.id), team: clean(row?.team?.name),
    player: clean(row?.player?.name), type: clean(row?.player?.type), reason: clean(row?.player?.reason)
  }))
  return {
    available: items.length > 0,
    homeCount: items.filter(item => item.teamId === String(homeId || '')).length,
    awayCount: items.filter(item => item.teamId === String(awayId || '')).length,
    items
  }
}

function normalizeLineups(rows = [], homeId, awayId) {
  const normalizeTeam = row => ({
    available: Boolean(row),
    teamId: clean(row?.team?.id), team: clean(row?.team?.name), logo: clean(row?.team?.logo),
    colors: {
      player: {
        primary: clean(row?.team?.colors?.player?.primary),
        number: clean(row?.team?.colors?.player?.number),
        border: clean(row?.team?.colors?.player?.border)
      },
      goalkeeper: {
        primary: clean(row?.team?.colors?.goalkeeper?.primary),
        number: clean(row?.team?.colors?.goalkeeper?.number),
        border: clean(row?.team?.colors?.goalkeeper?.border)
      }
    },
    formation: clean(row?.formation),
    coach: clean(row?.coach?.name),
    startXI: (row?.startXI || []).map((entry) => ({
      id: clean(entry?.player?.id), name: clean(entry?.player?.name),
      number: num(entry?.player?.number, 0), pos: clean(entry?.player?.pos), grid: clean(entry?.player?.grid)
    })).filter(player => player.id || player.name),
    substitutes: (row?.substitutes || []).map(entry => ({
      id: clean(entry?.player?.id), name: clean(entry?.player?.name), number: num(entry?.player?.number, 0), pos: clean(entry?.player?.pos)
    }))
  })
  const homeRow = rows.find(row => String(row?.team?.id || '') === String(homeId || '')) || null
  const awayRow = rows.find(row => String(row?.team?.id || '') === String(awayId || '')) || null
  const home = normalizeTeam(homeRow)
  const away = normalizeTeam(awayRow)
  return { available: home.startXI.length >= 11 || away.startXI.length >= 11, home, away }
}

function normalizeRecent(rows = [], teamId) {
  return (rows || []).slice(0, 8).map(row => {
    const homeId = String(row?.teams?.home?.id || '')
    const isHome = homeId === String(teamId || '')
    const gf = isHome ? num(row?.goals?.home) : num(row?.goals?.away)
    const ga = isHome ? num(row?.goals?.away) : num(row?.goals?.home)
    return {
      date: clean(row?.fixture?.date), league: clean(row?.league?.name),
      opponent: clean(isHome ? row?.teams?.away?.name : row?.teams?.home?.name),
      venue: isHome ? 'H' : 'A', gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D'
    }
  })
}

function normalizeTeamStatistics(row = {}) {
  const fixtures = row?.fixtures || {}
  const goals = row?.goals || {}
  return {
    available: Boolean(row && Object.keys(row).length),
    form: clean(row?.form),
    played: num(fixtures?.played?.total), wins: num(fixtures?.wins?.total), draws: num(fixtures?.draws?.total), losses: num(fixtures?.loses?.total),
    goalsForAvg: num(goals?.for?.average?.total), goalsAgainstAvg: num(goals?.against?.average?.total),
    cleanSheets: num(row?.clean_sheet?.total), failedToScore: num(row?.failed_to_score?.total),
    biggestWinHome: clean(row?.biggest?.wins?.home), biggestWinAway: clean(row?.biggest?.wins?.away)
  }
}

function findStanding(rows = [], teamId) {
  const leagues = rows?.[0]?.league?.standings || []
  const flat = Array.isArray(leagues) ? leagues.flat() : []
  const row = flat.find(item => String(item?.team?.id || '') === String(teamId || ''))
  if (!row) return null
  return {
    rank: num(row?.rank), points: num(row?.points), goalsDiff: num(row?.goalsDiff), form: clean(row?.form),
    played: num(row?.all?.played), wins: num(row?.all?.win), draws: num(row?.all?.draw), losses: num(row?.all?.lose),
    goalsFor: num(row?.all?.goals?.for), goalsAgainst: num(row?.all?.goals?.against)
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
  const qs = event.queryStringParameters || {}
  const fixtureId = clean(qs.fixture || qs.fixture_id).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  if (!fixtureId) return json(400, { error: 'Brak fixture id' })

  const fixtureResponse = await apiGet('/fixtures', { id: fixtureId })
  const fixtureRow = fixtureResponse.data?.[0] || null
  if (!fixtureRow) return json(404, { error: fixtureResponse.error || 'Nie znaleziono meczu w API-Football' })
  const fixture = normalizeFixture(fixtureRow)

  const common = [
    apiGet('/predictions', { fixture: fixtureId }),
    apiGet('/injuries', { fixture: fixtureId }),
    apiGet('/fixtures/lineups', { fixture: fixtureId }),
    fixture.home.id && fixture.away.id ? apiGet('/fixtures/headtohead', { h2h: `${fixture.home.id}-${fixture.away.id}`, last: 8 }) : Promise.resolve({ ok: false, data: [], error: 'Brak ID drużyn' }),
    fixture.leagueId && fixture.season ? apiGet('/standings', { league: fixture.leagueId, season: fixture.season }) : Promise.resolve({ ok: false, data: [], error: 'Brak ligi/sezonu' }),
    fixture.home.id ? apiGet('/fixtures', { team: fixture.home.id, last: 8 }) : Promise.resolve({ ok: false, data: [], error: 'Brak ID gospodarzy' }),
    fixture.away.id ? apiGet('/fixtures', { team: fixture.away.id, last: 8 }) : Promise.resolve({ ok: false, data: [], error: 'Brak ID gości' }),
    fixture.home.id && fixture.leagueId && fixture.season ? apiGet('/teams/statistics', { league: fixture.leagueId, season: fixture.season, team: fixture.home.id }) : Promise.resolve({ ok: false, data: [], error: 'Brak danych gospodarzy' }),
    fixture.away.id && fixture.leagueId && fixture.season ? apiGet('/teams/statistics', { league: fixture.leagueId, season: fixture.season, team: fixture.away.id }) : Promise.resolve({ ok: false, data: [], error: 'Brak danych gości' })
  ]

  const [predictionR, injuriesR, lineupsR, h2hR, standingsR, recentHomeR, recentAwayR, statsHomeR, statsAwayR] = await Promise.all(common)
  const errors = [
    fixtureResponse.ok ? '' : `Mecz: ${fixtureResponse.error}`,
    predictionR.ok ? '' : `Prognoza: ${predictionR.error}`,
    injuriesR.ok ? '' : `Absencje: ${injuriesR.error}`,
    lineupsR.ok ? '' : `Składy: ${lineupsR.error}`,
    h2hR.ok ? '' : `H2H: ${h2hR.error}`,
    standingsR.ok ? '' : `Tabela: ${standingsR.error}`,
    recentHomeR.ok ? '' : `Forma gospodarzy: ${recentHomeR.error}`,
    recentAwayR.ok ? '' : `Forma gości: ${recentAwayR.error}`,
    statsHomeR.ok ? '' : `Statystyki gospodarzy: ${statsHomeR.error}`,
    statsAwayR.ok ? '' : `Statystyki gości: ${statsAwayR.error}`
  ].filter(Boolean)

  return json(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'API-Football / API-Sports',
    apiAvailable: Boolean(API_KEY),
    partial: errors.length > 0,
    errors,
    fixture,
    prediction: normalizePrediction(predictionR.data?.[0] || {}),
    h2h: normalizeH2H(h2hR.data || [], fixture.home.id, fixture.away.id),
    injuries: normalizeInjuries(injuriesR.data || [], fixture.home.id, fixture.away.id),
    lineups: normalizeLineups(lineupsR.data || [], fixture.home.id, fixture.away.id),
    standings: {
      available: Boolean(standingsR.data?.length),
      home: findStanding(standingsR.data || [], fixture.home.id),
      away: findStanding(standingsR.data || [], fixture.away.id)
    },
    recent: {
      home: normalizeRecent(recentHomeR.data || [], fixture.home.id),
      away: normalizeRecent(recentAwayR.data || [], fixture.away.id)
    },
    teamStats: {
      home: normalizeTeamStatistics(statsHomeR.data?.[0] || {}),
      away: normalizeTeamStatistics(statsAwayR.data?.[0] || {})
    }
  })
}
