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

function normalizeLineupTeamRow(row = null) {
  return {
    available: Boolean(row),
    official: Boolean(row),
    predicted: false,
    predictionConfidence: 0,
    sourceMatches: 0,
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
    })).filter(player => player.id || player.name)
  }
}

function normalizeLineups(rows = [], homeId, awayId) {
  const homeRow = rows.find(row => String(row?.team?.id || '') === String(homeId || '')) || null
  const awayRow = rows.find(row => String(row?.team?.id || '') === String(awayId || '')) || null
  const home = normalizeLineupTeamRow(homeRow)
  const away = normalizeLineupTeamRow(awayRow)
  return { available: home.startXI.length >= 11 || away.startXI.length >= 11, home, away }
}

function normalizeNameKey(value = '') {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function isCompletedFixture(row = {}) {
  const short = clean(row?.fixture?.status?.short).toUpperCase()
  return ['FT', 'AET', 'PEN'].includes(short)
}

async function fetchRecentLineupHistory(recentRows = [], teamId, limit = 3) {
  const fixtureIds = []
  for (const row of recentRows || []) {
    if (!isCompletedFixture(row)) continue
    const id = clean(row?.fixture?.id)
    if (!id || fixtureIds.includes(id)) continue
    fixtureIds.push(id)
    if (fixtureIds.length >= limit) break
  }
  if (!fixtureIds.length) return { rows: [], errors: [] }
  const responses = await Promise.all(fixtureIds.map(id => apiGet('/fixtures/lineups', { fixture: id })))
  const history = []
  const errors = []
  responses.forEach((response, index) => {
    if (!response.ok) {
      errors.push(`Historia składu ${fixtureIds[index]}: ${response.error}`)
      return
    }
    const row = (response.data || []).find(item => String(item?.team?.id || '') === String(teamId || '')) || null
    const normalized = normalizeLineupTeamRow(row)
    if (normalized.startXI.length >= 11) history.push(normalized)
  })
  return { rows: history, errors }
}

function buildPredictedLineup(history = [], injuries = [], teamId = '') {
  const complete = (history || []).filter(item => (item?.startXI?.length || 0) >= 11)
  if (!complete.length) return null
  const base = complete.find(item => item.startXI.filter(player => /^\d+:\d+$/.test(player.grid || '')).length >= 9) || complete[0]
  const injured = new Set((injuries || [])
    .filter(item => String(item.teamId || '') === String(teamId || ''))
    .map(item => normalizeNameKey(item.player))
    .filter(Boolean))

  const candidates = new Map()
  complete.forEach((lineup, index) => {
    const recency = Math.max(1, 5 - index * 1.4)
    lineup.startXI.forEach(player => {
      const key = clean(player.id) || normalizeNameKey(player.name)
      if (!key) return
      const current = candidates.get(key) || { ...player, starts: 0, bench: 0, score: 0, appearances: 0 }
      current.starts += 1
      current.appearances += 1
      current.score += 10 + recency
      if (!current.grid && player.grid) current.grid = player.grid
      if (!current.pos && player.pos) current.pos = player.pos
      if (!current.number && player.number) current.number = player.number
      candidates.set(key, current)
    })
    lineup.substitutes.forEach(player => {
      const key = clean(player.id) || normalizeNameKey(player.name)
      if (!key) return
      const current = candidates.get(key) || { ...player, starts: 0, bench: 0, score: 0, appearances: 0 }
      current.bench += 1
      current.appearances += 1
      current.score += 2 + recency * 0.35
      candidates.set(key, current)
    })
  })

  const used = new Set()
  let injuryReplacements = 0
  const predictedXI = base.startXI.map(slot => {
    const slotPos = clean(slot.pos).toUpperCase()
    const baseKey = clean(slot.id) || normalizeNameKey(slot.name)
    const ranked = [...candidates.entries()]
      .filter(([key, player]) => !used.has(key) && !injured.has(normalizeNameKey(player.name)))
      .map(([key, player]) => ({
        key,
        player,
        rank: player.score + (clean(player.pos).toUpperCase() === slotPos ? 34 : 0) + (key === baseKey ? 8 : 0)
      }))
      .sort((a, b) => b.rank - a.rank)
    const samePos = ranked.find(item => clean(item.player.pos).toUpperCase() === slotPos)
    const choice = samePos || ranked[0]
    if (!choice) return null
    used.add(choice.key)
    if (choice.key !== baseKey) injuryReplacements += injured.has(normalizeNameKey(slot.name)) ? 1 : 0
    return {
      id: choice.player.id,
      name: choice.player.name,
      number: choice.player.number || slot.number,
      pos: choice.player.pos || slot.pos,
      grid: slot.grid
    }
  }).filter(Boolean)

  if (predictedXI.length < 11) return null
  const avgStartRate = predictedXI.reduce((sum, player) => {
    const key = clean(player.id) || normalizeNameKey(player.name)
    const info = candidates.get(key)
    return sum + (info ? info.starts / Math.max(1, complete.length) : 0)
  }, 0) / 11
  const confidence = Math.max(58, Math.min(91, Math.round(58 + complete.length * 6 + avgStartRate * 22 - injuryReplacements * 3)))
  const substitutes = [...candidates.entries()]
    .filter(([key, player]) => !used.has(key) && !injured.has(normalizeNameKey(player.name)))
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 9)
    .map(([, player]) => ({ id: player.id, name: player.name, number: player.number, pos: player.pos }))

  return {
    ...base,
    available: true,
    official: false,
    predicted: true,
    predictionConfidence: confidence,
    sourceMatches: complete.length,
    startXI: predictedXI,
    substitutes
  }
}

function hasUsableGrid(lineup = {}) {
  return (lineup?.startXI || []).filter(player => /^\d+:\d+$/.test(player.grid || '')).length >= 9
}

function buildSimulationQuality({ prediction, h2h, injuriesFetchOk, lineups, standings, recent, teamStats }) {
  const checks = {
    form: (recent?.home?.length || 0) >= 5 && (recent?.away?.length || 0) >= 5,
    h2h: (h2h?.summary?.count || 0) >= 2,
    injuries: Boolean(injuriesFetchOk),
    lineups: (lineups?.home?.startXI?.length || 0) >= 11 && (lineups?.away?.startXI?.length || 0) >= 11 && hasUsableGrid(lineups.home) && hasUsableGrid(lineups.away),
    standings: Boolean(standings?.home && standings?.away),
    teamStats: Boolean(teamStats?.home?.available && teamStats?.away?.available),
    prediction: Boolean(prediction?.available)
  }
  const weights = { form: 18, h2h: 10, injuries: 8, lineups: 22, standings: 10, teamStats: 18, prediction: 14 }
  const score = Object.entries(checks).reduce((sum, [key, ok]) => sum + (ok ? weights[key] : 0), 0)
  const labels = {
    form: 'minimum 5 ostatnich meczów obu drużyn',
    h2h: 'minimum 2 mecze H2H',
    injuries: 'sprawdzenie absencji',
    lineups: 'oficjalny lub przewidywany XI z pozycjami',
    standings: 'pełna pozycja obu drużyn w tabeli',
    teamStats: 'pełne statystyki sezonowe obu drużyn',
    prediction: 'prognoza API'
  }
  const reasons = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => labels[key])
  return { eligible: reasons.length === 0 && score >= 90, score, checks, reasons }
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
  const prediction = normalizePrediction(predictionR.data?.[0] || {})
  const h2h = normalizeH2H(h2hR.data || [], fixture.home.id, fixture.away.id)
  const injuries = normalizeInjuries(injuriesR.data || [], fixture.home.id, fixture.away.id)
  let lineups = normalizeLineups(lineupsR.data || [], fixture.home.id, fixture.away.id)
  const recent = {
    home: normalizeRecent(recentHomeR.data || [], fixture.home.id),
    away: normalizeRecent(recentAwayR.data || [], fixture.away.id)
  }
  const standings = {
    available: Boolean(standingsR.data?.length),
    home: findStanding(standingsR.data || [], fixture.home.id),
    away: findStanding(standingsR.data || [], fixture.away.id)
  }
  const teamStats = {
    home: normalizeTeamStatistics(statsHomeR.data?.[0] || {}),
    away: normalizeTeamStatistics(statsAwayR.data?.[0] || {})
  }

  const historicalErrors = []
  if ((lineups.home.startXI.length || 0) < 11 || (lineups.away.startXI.length || 0) < 11) {
    const [homeHistoryR, awayHistoryR] = await Promise.all([
      (lineups.home.startXI.length || 0) < 11 ? fetchRecentLineupHistory(recentHomeR.data || [], fixture.home.id, 3) : Promise.resolve({ rows: [], errors: [] }),
      (lineups.away.startXI.length || 0) < 11 ? fetchRecentLineupHistory(recentAwayR.data || [], fixture.away.id, 3) : Promise.resolve({ rows: [], errors: [] })
    ])
    historicalErrors.push(...homeHistoryR.errors, ...awayHistoryR.errors)
    if ((lineups.home.startXI.length || 0) < 11) {
      const predictedHome = buildPredictedLineup(homeHistoryR.rows, injuries.items, fixture.home.id)
      if (predictedHome) lineups.home = predictedHome
    }
    if ((lineups.away.startXI.length || 0) < 11) {
      const predictedAway = buildPredictedLineup(awayHistoryR.rows, injuries.items, fixture.away.id)
      if (predictedAway) lineups.away = predictedAway
    }
    lineups.available = lineups.home.startXI.length >= 11 || lineups.away.startXI.length >= 11
  }

  const injuriesFetchOk = injuriesR.ok
  const quality = buildSimulationQuality({ prediction, h2h, injuriesFetchOk, lineups, standings, recent, teamStats })
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
    statsAwayR.ok ? '' : `Statystyki gości: ${statsAwayR.error}`,
    ...historicalErrors
  ].filter(Boolean)

  return json(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'API-Football / API-Sports',
    apiAvailable: Boolean(API_KEY),
    partial: errors.length > 0,
    errors,
    fixture,
    prediction,
    h2h,
    injuries,
    lineups,
    standings,
    recent,
    teamStats,
    simulationQuality: quality
  })
}
