const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY || process.env.VITE_API_FOOTBALL_KEY || ''
const API_HOST = 'https://v3.football.api-sports.io'
const TIMEZONE = 'Europe/Warsaw'
const memoryCache = new Map()
const oddsMemoryCache = new Map()

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

function dateKeyInTimezone(value = new Date(), timeZone = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function addDaysToDateKey(dateKey, amount) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0)).toISOString().slice(0, 10)
}

function getDateForDay(day) {
  const today = dateKeyInTimezone(new Date())
  if (day === 'yesterday') return addDaysToDateKey(today, -1)
  if (day === 'tomorrow') return addDaysToDateKey(today, 1)
  return today
}

function normalizeRequestedDate(value, fallbackDay = 'today') {
  const text = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return getDateForDay(fallbackDay)
}

function cleanStatus(short, long) {
  const code = String(short || '').toUpperCase()
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(code)) return code === 'LIVE' ? 'LIVE' : code
  if (code === 'HT') return 'HT'
  if (['FT', 'AET', 'PEN'].includes(code)) return code
  if (['NS', 'TBD'].includes(code)) return code
  if (['PST', 'CANC', 'ABD', 'SUSP', 'INT', 'AWD', 'WO'].includes(code)) return code
  return code || long || '—'
}

function kickoffTime(fixture = {}) {
  const value = fixture.date ? new Date(fixture.date) : fixture.timestamp ? new Date(fixture.timestamp * 1000) : null
  if (!value || !Number.isFinite(value.getTime())) return '—'
  return value.toLocaleTimeString('pl-PL', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function minuteFromFixture(fixture = {}) {
  const status = fixture.status || {}
  const code = String(status.short || '').toUpperCase()
  if (status.elapsed) return `${status.elapsed}′`
  if (code === 'HT') return 'Przerwa'
  if (['FT', 'AET', 'PEN'].includes(code)) return 'Koniec'
  return kickoffTime(fixture)
}

function teamCode(name = '') {
  const words = String(name).replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0] || ''}${words[1][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase().slice(0, 3)
  return String(name).slice(0, 3).toUpperCase() || '---'
}

function countryPl(name = '') {
  const map = {
    England: 'Anglia', Spain: 'Hiszpania', Italy: 'Włochy', Germany: 'Niemcy', France: 'Francja', Poland: 'Polska', Netherlands: 'Holandia', Portugal: 'Portugalia', Belgium: 'Belgia', Turkey: 'Turcja', Scotland: 'Szkocja', USA: 'USA', World: 'Świat', Europe: 'Europa',
    Belarus: 'Białoruś', Estonia: 'Estonia', Finland: 'Finlandia', Georgia: 'Gruzja', Kazakhstan: 'Kazachstan', Lithuania: 'Litwa', Latvia: 'Łotwa', Denmark: 'Dania', Norway: 'Norwegia', Sweden: 'Szwecja', Switzerland: 'Szwajcaria', Austria: 'Austria', Croatia: 'Chorwacja', Serbia: 'Serbia', Ukraine: 'Ukraina', Romania: 'Rumunia', Bulgaria: 'Bułgaria', Czechia: 'Czechy', Slovakia: 'Słowacja', Slovenia: 'Słowenia', Greece: 'Grecja', Cyprus: 'Cypr', Ireland: 'Irlandia', Iceland: 'Islandia', Israel: 'Izrael', Hungary: 'Węgry', Albania: 'Albania', Bosnia: 'Bośnia i Hercegowina', Montenegro: 'Czarnogóra', 'Saudi-Arabia': 'Arabia Saudyjska', Australia: 'Australia', Brazil: 'Brazylia', Argentina: 'Argentyna', Mexico: 'Meksyk', Canada: 'Kanada', Chile: 'Chile', Colombia: 'Kolumbia', Peru: 'Peru', Uruguay: 'Urugwaj', Paraguay: 'Paragwaj', Japan: 'Japonia', China: 'Chiny', 'Korea-Republic': 'Korea Południowa',
  }
  return map[name] || name || 'Świat'
}

function extractThreeWayOdds(row = {}) {
  const bookmakers = Array.isArray(row.bookmakers) ? row.bookmakers : []
  for (const bookmaker of bookmakers) {
    const bets = Array.isArray(bookmaker.bets) ? bookmaker.bets : []
    const market = bets.find((bet) => {
      const name = String(bet.name || '').toLowerCase()
      return Number(bet.id) === 1 || name.includes('match winner') || name === '1x2'
    })
    if (!market) continue
    const values = Array.isArray(market.values) ? market.values : []
    const findValue = (...names) => {
      const entry = values.find((item) => names.includes(String(item.value || '').toLowerCase()))
      return entry?.odd ? String(entry.odd) : '-'
    }
    return {
      odds: [findValue('home', '1'), findValue('draw', 'x'), findValue('away', '2')],
      bookmaker: bookmaker.name || '',
      updatedAt: row.update || '',
    }
  }
  return { odds: ['-', '-', '-'], bookmaker: '', updatedAt: '' }
}

async function fetchOddsMap(date) {
  const cached = oddsMemoryCache.get(date)
  if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) return cached.map

  const result = new Map()
  try {
    const url = new URL(`${API_HOST}/odds`)
    url.searchParams.set('date', date)
    url.searchParams.set('timezone', TIMEZONE)
    url.searchParams.set('page', '1')
    const response = await fetch(url.toString(), { headers: { 'x-apisports-key': API_KEY } })
    if (!response.ok) return result
    const payload = await response.json().catch(() => ({}))
    const rows = Array.isArray(payload?.response) ? payload.response : []
    rows.forEach((row) => {
      const fixtureId = String(row?.fixture?.id || '')
      if (!fixtureId) return
      result.set(fixtureId, extractThreeWayOdds(row))
    })
  } catch (_) {}
  oddsMemoryCache.set(date, { savedAt: Date.now(), map: result })
  return result
}

function mapFixture(row = {}, oddsMap = new Map()) {
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
  const oddsInfo = oddsMap.get(String(fixture.id || '')) || { odds: ['-', '-', '-'], bookmaker: '', updatedAt: '' }
  return {
    id: String(fixture.id || `${homeName}-${awayName}-${fixture.date}`),
    source: 'api-football',
    sport: 'football',
    country: countryPl(league.country),
    league: league.name || 'Liga',
    leagueId: league.id || null,
    leagueLogo: league.logo || '',
    leagueFlag: league.flag || '',
    season: league.season || null,
    round: league.round || '',
    status,
    statusLong: fixture.status?.long || '',
    minute: minuteFromFixture(fixture),
    kickoffTime: kickoffTime(fixture),
    timestamp: fixture.timestamp || 0,
    date: fixture.date || '',
    venue: fixture.venue?.name || '',
    city: fixture.venue?.city || '',
    referee: fixture.referee || '',
    timezone: fixture.timezone || TIMEZONE,
    home: {
      name: homeName,
      score: homeScore,
      logo: teamCode(homeName),
      image: teams.home?.logo || '',
      winner: teams.home?.winner === true,
    },
    away: {
      name: awayName,
      score: awayScore,
      logo: teamCode(awayName),
      image: teams.away?.logo || '',
      winner: teams.away?.winner === true,
    },
    halftime: {
      home: score.halftime?.home ?? '-',
      away: score.halftime?.away ?? '-',
    },
    fulltime: {
      home: score.fulltime?.home ?? '-',
      away: score.fulltime?.away ?? '-',
    },
    overtime: {
      home: score.extratime?.home ?? '-',
      away: score.extratime?.away ?? '-',
    },
    penalties: {
      home: score.penalty?.home ?? '-',
      away: score.penalty?.away ?? '-',
    },
    odds: oddsInfo.odds,
    oddsBookmaker: oddsInfo.bookmaker,
    oddsUpdatedAt: oddsInfo.updatedAt,
    trend: ['1H', '2H', 'ET', 'LIVE'].includes(status) ? 'LIVE' : status,
  }
}

async function fetchFootballFixtures(date, includeOdds = true) {
  if (!API_KEY) {
    return {
      matches: [],
      error: 'Brak klucza API. Dodaj w Netlify Environment Variables: API_FOOTBALL_KEY albo APISPORTS_KEY.',
      missingKey: true,
    }
  }

  const fixturesUrl = new URL(`${API_HOST}/fixtures`)
  fixturesUrl.searchParams.set('date', date)
  fixturesUrl.searchParams.set('timezone', TIMEZONE)

  const [fixtureResponse, oddsMap] = await Promise.all([
    fetch(fixturesUrl.toString(), { headers: { 'x-apisports-key': API_KEY } }),
    includeOdds ? fetchOddsMap(date) : Promise.resolve(new Map()),
  ])

  const text = await fixtureResponse.text()
  let payload = null
  try { payload = JSON.parse(text) } catch (_) {}
  if (!fixtureResponse.ok) {
    throw new Error(payload?.message || payload?.errors?.requests || `API Football HTTP ${fixtureResponse.status}`)
  }

  const rows = Array.isArray(payload?.response) ? payload.response : []
  const mapped = rows.map((row) => mapFixture(row, oddsMap))
  const priority = { '1H': 0, '2H': 0, LIVE: 0, ET: 0, HT: 1, NS: 2, TBD: 2, PST: 3, FT: 4, AET: 4, PEN: 4 }
  mapped.sort((a, b) => {
    const pa = priority[a.status] ?? 2
    const pb = priority[b.status] ?? 2
    if (pa !== pb) return pa - pb
    return (a.timestamp || 0) - (b.timestamp || 0)
  })

  return {
    matches: mapped.slice(0, 180),
    date,
    api: 'api-football',
    timezone: TIMEZONE,
    oddsAvailable: Array.from(oddsMap.values()).some((item) => item.odds.some((odd) => odd !== '-')),
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true })

  try {
    const day = event.queryStringParameters?.day || 'today'
    const date = normalizeRequestedDate(event.queryStringParameters?.date, day)
    const sport = event.queryStringParameters?.sport || 'all'
    const includeOdds = event.queryStringParameters?.odds !== '0'
    const force = event.queryStringParameters?.force === '1'

    if (!['all', 'football'].includes(sport)) {
      return json(200, {
        ok: true,
        live: true,
        matches: [],
        date,
        timezone: TIMEZONE,
        message: 'Realne API jest obecnie podpięte dla piłki nożnej.',
        updatedAt: new Date().toISOString(),
      })
    }

    const cacheKey = `${date}:${includeOdds ? 'odds' : 'no-odds'}`
    const cached = memoryCache.get(cacheKey)
    const today = dateKeyInTimezone(new Date())
    const ttl = date === today ? 55 * 1000 : 5 * 60 * 1000

    if (!force && cached && Date.now() - cached.savedAt < ttl) {
      return json(200, {
        ok: !cached.data.missingKey,
        live: !cached.data.missingKey,
        cached: true,
        ...cached.data,
        updatedAt: cached.updatedAt,
      })
    }

    const result = await fetchFootballFixtures(date, includeOdds)
    const updatedAt = new Date().toISOString()
    memoryCache.set(cacheKey, { savedAt: Date.now(), updatedAt, data: result })

    return json(200, {
      ok: !result.missingKey,
      live: !result.missingKey,
      cached: false,
      ...result,
      updatedAt,
    })
  } catch (error) {
    return json(200, {
      ok: false,
      live: false,
      matches: [],
      error: error.message || 'Nie udało się pobrać realnych wyników live.',
      timezone: TIMEZONE,
      updatedAt: new Date().toISOString(),
    })
  }
}
