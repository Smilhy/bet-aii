const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY || process.env.VITE_API_FOOTBALL_KEY || ''
const API_HOST = 'https://v3.football.api-sports.io'

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  },
  body: JSON.stringify(body),
})

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDateForDay(day) {
  const base = new Date()
  if (day === 'yesterday') base.setDate(base.getDate() - 1)
  if (day === 'tomorrow') base.setDate(base.getDate() + 1)
  return formatDate(base)
}

function cleanStatus(short, long) {
  const code = String(short || '').toUpperCase()
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(code)) return 'LIVE'
  if (code === 'HT') return 'HT'
  if (['FT', 'AET', 'PEN'].includes(code)) return 'FT'
  if (['NS', 'TBD'].includes(code)) return 'NS'
  if (['PST', 'CANC', 'ABD', 'SUSP', 'INT'].includes(code)) return code
  return code || long || '—'
}

function minuteFromFixture(fixture = {}) {
  const status = fixture.status || {}
  const code = String(status.short || '').toUpperCase()
  if (status.elapsed) return `${status.elapsed}′`
  if (code === 'HT') return 'Przerwa'
  if (code === 'FT') return 'Koniec'
  const ts = fixture.timestamp ? new Date(fixture.timestamp * 1000) : new Date(fixture.date || Date.now())
  if (Number.isFinite(ts.getTime())) {
    return ts.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  }
  return status.long || '—'
}

function teamCode(name = '') {
  const words = String(name).replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0] || ''}${words[1][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase().slice(0, 3)
  return String(name).slice(0, 3).toUpperCase() || '---'
}

function countryPl(name = '') {
  const map = {
    England: 'Anglia', Spain: 'Hiszpania', Italy: 'Włochy', Germany: 'Niemcy', France: 'Francja', Poland: 'Polska', Netherlands: 'Holandia', Portugal: 'Portugalia', Belgium: 'Belgia', Turkey: 'Turcja', Scotland: 'Szkocja', USA: 'USA', World: 'Świat', Europe: 'Europa'
  }
  return map[name] || name || 'Świat'
}

function mapFixture(row = {}) {
  const fixture = row.fixture || {}
  const league = row.league || {}
  const teams = row.teams || {}
  const goals = row.goals || {}
  const score = row.score || {}
  const status = cleanStatus(fixture.status?.short, fixture.status?.long)
  const homeScore = goals.home ?? score.fulltime?.home ?? score.halftime?.home ?? '-'
  const awayScore = goals.away ?? score.fulltime?.away ?? score.halftime?.away ?? '-'
  const homeName = teams.home?.name || 'Gospodarze'
  const awayName = teams.away?.name || 'Goście'
  return {
    id: String(fixture.id || `${homeName}-${awayName}-${fixture.date}`),
    source: 'api-football',
    sport: 'football',
    day: 'today',
    country: countryPl(league.country),
    league: league.name || 'Liga',
    leagueLogo: league.logo || '',
    status,
    minute: minuteFromFixture(fixture),
    timestamp: fixture.timestamp || 0,
    home: {
      name: homeName,
      score: homeScore,
      logo: teamCode(homeName),
      image: teams.home?.logo || '',
      scorers: []
    },
    away: {
      name: awayName,
      score: awayScore,
      logo: teamCode(awayName),
      image: teams.away?.logo || '',
      scorers: []
    },
    odds: ['-', '-', '-'],
    stats: {
      possession: 'Dane live API',
      shots: fixture.venue?.name || '—',
      corners: fixture.referee || '—'
    },
    trend: status === 'LIVE' ? 'LIVE' : status,
  }
}

async function fetchFootballFixtures(day) {
  if (!API_KEY) {
    return { matches: [], error: 'Brak klucza API. Dodaj w Netlify Environment Variables: API_FOOTBALL_KEY albo APISPORTS_KEY.', missingKey: true }
  }

  const date = getDateForDay(day)
  const url = new URL(`${API_HOST}/fixtures`)
  url.searchParams.set('date', date)
  url.searchParams.set('timezone', 'Europe/London')

  const response = await fetch(url.toString(), {
    headers: { 'x-apisports-key': API_KEY },
  })
  const text = await response.text()
  let payload = null
  try { payload = JSON.parse(text) } catch (_) {}
  if (!response.ok) {
    throw new Error(payload?.message || payload?.errors?.requests || `API Football HTTP ${response.status}`)
  }
  const rows = Array.isArray(payload?.response) ? payload.response : []
  const mapped = rows.map(mapFixture)
  const priority = { LIVE: 0, HT: 1, NS: 2, FT: 3 }
  mapped.sort((a, b) => {
    const pa = priority[a.status] ?? 2
    const pb = priority[b.status] ?? 2
    if (pa !== pb) return pa - pb
    return (a.timestamp || 0) - (b.timestamp || 0)
  })
  return { matches: mapped.slice(0, 120), date, api: 'api-football' }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true })
  try {
    const day = event.queryStringParameters?.day || 'today'
    const sport = event.queryStringParameters?.sport || 'all'
    if (!['all', 'football'].includes(sport)) {
      return json(200, { ok: true, live: true, matches: [], message: 'Na razie realne API jest podpięte dla piłki nożnej. Pozostałe sporty można dopiąć osobnymi API-SPORTS endpointami.', updatedAt: new Date().toISOString() })
    }
    const result = await fetchFootballFixtures(day)
    return json(200, { ok: true, live: true, ...result, updatedAt: new Date().toISOString() })
  } catch (error) {
    return json(200, { ok: false, live: false, matches: [], error: error.message || 'Nie udało się pobrać realnych wyników live.', updatedAt: new Date().toISOString() })
  }
}
