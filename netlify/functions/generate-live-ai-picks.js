const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REAL_AI_MIN_ODDS_V1691 = 1.50
const REAL_AI_MIN_PROBABILITY_V1692 = 48
const API_SPORTS_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

exports.config = { schedule: process.env.BETAI_DAILY_AI_CRON || '1 0 * * *' }

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
function round(v, d = 2) { const f = 10 ** d; return Math.round(Number(v || 0) * f) / f }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v || 0))) }
function nowIso() { return new Date().toISOString() }
function isoDate(d) { return d.toISOString().slice(0, 10) }
function warsawDateKey(value = new Date(), offsetDays = 0) {
  const base = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (!Number.isFinite(base.getTime())) return ''
  base.setUTCDate(base.getUTCDate() + Number(offsetDays || 0))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(base).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function allowedWarsawDateKeys(days = 2) {
  const count = Math.max(1, Math.min(14, Number(days || 1)))
  return new Set(Array.from({ length: count }, (_, index) => warsawDateKey(new Date(), index)))
}
function eventWarsawDateKey(event) {
  return warsawDateKey(event?.event_time || event?.commence_time || event?.kickoff_time || event?.match_time || event?.date || new Date())
}
function isEventInAllowedWarsawDays(event, keys) {
  const key = eventWarsawDateKey(event)
  return key && keys.has(key)
}
function hashNumber(input) {
  const s = String(input || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h >>> 0)
}
function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (!s) return 'pending'
  if (s.includes('live') || s.includes('progress') || s.includes('quarter') || s.includes('half') || s.includes('round') || ['1h','2h','ht','et','bt','q1','q2','q3','q4'].includes(s)) return 'live'
  if (s.includes('not') || s.includes('scheduled') || s.includes('ns') || s.includes('time')) return 'pending'
  if (s.includes('post') || s.includes('cancel') || s.includes('suspend')) return 'blocked'
  if (s.includes('finish') || s.includes('final') || s === 'ft') return 'finished'
  return 'pending'
}
function safeName(v, fallback = '') {
  if (v == null) return fallback
  if (typeof v === 'string') return v || fallback
  if (typeof v === 'object') return v.name || v.long || v.short || v.title || fallback
  return String(v)
}

function cachedFixtureToAiEvent(row) {
  // WERSJA 1701: musi używać prawdziwego fixture.id z API, inaczej odds mogą przykleić się do złego meczu.
  const fx = row?.fixture_json && typeof row.fixture_json === 'object' ? row.fixture_json : {}
  const home = safeName(row?.home || fx.home || fx.home_team || fx.team_home || fx?.teams?.home?.name, '')
  const away = safeName(row?.away || fx.away || fx.away_team || fx.team_away || fx?.teams?.away?.name || fx?.teams?.visitors?.name, '')
  const commenceTime = row?.commence_time || fx.commence_time || fx.event_time || fx.kickoff_time || fx.date || fx?.fixture?.date
  if (!home || !away || !commenceTime) return null

  const eventMs = Date.parse(commenceTime)
  if (!Number.isFinite(eventMs) || eventMs <= Date.now()) return null

  const realFixtureId =
    fx?.fixture?.id ||
    fx?.game?.id ||
    fx?.event?.id ||
    fx?.apiFixtureId ||
    fx?.api_fixture_id ||
    fx?.fixture_id ||
    fx?.id ||
    row?.fixture_id ||
    null

  // Jeśli nie ma realnego fixture ID, zostawiamy event do listy, ale odds API nie będą do niego dopasowane.
  const id = realFixtureId || row?.cache_key || `${home}-${away}-${commenceTime}`

  return {
    id: `football-${id}`,
    external_fixture_id: realFixtureId ? Number(String(realFixtureId).replace(/\D/g, '').slice(0, 12)) : null,
    api_fixture_id: realFixtureId ? String(realFixtureId) : '',
    sport: row?.sport || fx.sport || 'Piłka nożna',
    sport_key: 'football',
    league: row?.league || fx.league || fx.league_name || fx?.league?.name || 'Piłka nożna',
    country: row?.country || fx.country || fx?.league?.country || '',
    home,
    away,
    event_time: commenceTime,
    status: 'pending',
    live_score_home: 0,
    live_score_away: 0,
    rawStatus: 'NS',
    source: 'sports_fixture_cache'
  }
}

async function fetchCachedFootballEvents(supabase, days = 3) {
  const now = new Date()
  const end = new Date(now.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('sports_fixture_cache')
    .select('cache_key,sport,country,league,home,away,commence_time,fixture_json,expires_at')
    .gt('expires_at', now.toISOString())
    .gt('commence_time', now.toISOString())
    .lt('commence_time', end.toISOString())
    .order('commence_time', { ascending: true })
    .limit(Number(process.env.REAL_MATCHES_LIMIT || 500))

  if (error) throw error

  return (data || [])
    .map(row => cachedFixtureToAiEvent(row))
    .filter(Boolean)
}

const SPORT_APIS = [
  { sport: 'Piłka nożna', key: 'football', host: 'https://v3.football.api-sports.io', path: '/fixtures', dateParam: 'date', type: 'football' },
  { sport: 'Koszykówka', key: 'basketball', host: 'https://v1.basketball.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'NBA', key: 'nba', host: 'https://v2.nba.api-sports.io', path: '/games', dateParam: 'date', type: 'nba' },
  { sport: 'Baseball', key: 'baseball', host: 'https://v1.baseball.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'Hokej', key: 'hockey', host: 'https://v1.hockey.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'MMA', key: 'mma', host: 'https://v1.mma.api-sports.io', path: '/fights', dateParam: 'date', type: 'fights' },
  { sport: 'Siatkówka', key: 'volleyball', host: 'https://v1.volleyball.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'Piłka ręczna', key: 'handball', host: 'https://v1.handball.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'NFL', key: 'nfl', host: 'https://v1.american-football.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'Rugby', key: 'rugby', host: 'https://v1.rugby.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
  { sport: 'AFL', key: 'afl', host: 'https://v1.afl.api-sports.io', path: '/games', dateParam: 'date', type: 'games' },
]

function selectedSportKeys(event) {
  const q = event?.queryStringParameters || {}
  const raw = String(q.sport || q.filter || q.category || q.sports || '').toLowerCase()
  if (!raw || raw === 'all' || raw === 'wszystkie') return SPORT_APIS
  return SPORT_APIS.filter(x => raw.includes(x.key) || raw.includes(x.sport.toLowerCase()) || (raw.includes('pilka') && x.key === 'football') || (raw.includes('piłka') && x.key === 'football'))
}

async function apiSportsFetch(cfg, date) {
  const url = `${cfg.host}${cfg.path}?${cfg.dateParam}=${encodeURIComponent(date)}`
  const res = await fetch(url, { headers: { 'x-apisports-key': API_SPORTS_KEY } })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  const errors = data?.errors && typeof data.errors === 'object' ? data.errors : null
  if (!res.ok || (errors && Object.keys(errors).length)) {
    const msg = errors && Object.keys(errors).length ? JSON.stringify(errors) : text.slice(0, 300)
    throw new Error(`${cfg.key} ${date} ${res.status}: ${msg}`)
  }
  const rows = Array.isArray(data?.response) ? data.response : []
  return rows
}

function normalizeApiSportsEvent(item, cfg) {
  const id = item?.fixture?.id || item?.game?.id || item?.id || item?.fight?.id || item?.event?.id
  const rawDate = item?.fixture?.date || item?.game?.date?.date || item?.game?.date || item?.date || item?.fight?.date || item?.event?.date
  const timestamp = item?.fixture?.timestamp || item?.game?.date?.timestamp || item?.timestamp
  const eventTime = rawDate ? new Date(rawDate).toISOString() : (timestamp ? new Date(Number(timestamp) * 1000).toISOString() : nowIso())
  const statusRaw = item?.fixture?.status?.short || item?.fixture?.status?.long || item?.game?.status?.short || item?.game?.status?.long || item?.status?.short || item?.status?.long || item?.status || ''
  const status = normalizeStatus(statusRaw)
  if (status === 'blocked' || status === 'finished') return null

  let home = item?.teams?.home?.name || item?.teams?.home?.team?.name || item?.home?.name || item?.fighters?.first?.name || item?.fighters?.home?.name || item?.competitors?.home?.name
  let away = item?.teams?.away?.name || item?.teams?.away?.team?.name || item?.away?.name || item?.fighters?.second?.name || item?.fighters?.away?.name || item?.competitors?.away?.name

  // API-NBA often returns teams.home.name / teams.visitors.name
  if (!away) away = item?.teams?.visitors?.name || item?.teams?.away?.name
  if (!home) home = item?.teams?.home?.name

  home = safeName(home, 'Gospodarz')
  away = safeName(away, 'Gość')
  if (!id || !home || !away || home === 'Gospodarz' && away === 'Gość') return null

  const league = item?.league?.name || item?.league?.league?.name || item?.competition?.name || item?.category?.name || item?.country?.name || cfg.sport
  const country = item?.league?.country || item?.country?.name || item?.country || null
  const rawScoreHome = item?.goals?.home ?? item?.scores?.home?.total ?? item?.score?.home ?? item?.teams?.home?.score
  const rawScoreAway = item?.goals?.away ?? item?.scores?.away?.total ?? item?.score?.away ?? item?.teams?.away?.score ?? item?.teams?.visitors?.score
  const scoreHome = rawScoreHome === undefined || rawScoreHome === null || rawScoreHome === '' ? null : Number(rawScoreHome)
  const scoreAway = rawScoreAway === undefined || rawScoreAway === null || rawScoreAway === '' ? null : Number(rawScoreAway)

  return {
    id: `${cfg.key}-${id}`,
    external_fixture_id: Number(String(id).replace(/\D/g, '').slice(0, 12)) || hashNumber(`${cfg.key}-${id}`),
    sport: cfg.sport,
    sport_key: cfg.key,
    league: safeName(league, cfg.sport),
    country: safeName(country, ''),
    home,
    away,
    event_time: eventTime,
    status,
    live_score_home: scoreHome,
    live_score_away: scoreAway,
    rawStatus: statusRaw || (status === 'live' ? 'LIVE' : 'NS'),
    source: 'api-sports'
  }
}

async function fetchAllRealEvents(event) {
  if (!API_SPORTS_KEY) throw new Error('Brak APISPORTS_KEY / API_FOOTBALL_KEY w Netlify Environment Variables.')
  const days = clamp(Number(event?.queryStringParameters?.days || process.env.REAL_AI_LOOKAHEAD_DAYS || 1), 1, 14)
  const chosen = selectedSportKeys(event)
  const dates = []
  for (let i = 0; i < days; i++) dates.push(isoDate(new Date(Date.now() + i * 24 * 60 * 60 * 1000)))
  const all = []
  const errors = []
  for (const cfg of chosen) {
    for (const date of dates) {
      try {
        const rows = await apiSportsFetch(cfg, date)
        for (const item of rows) {
          const normalized = normalizeApiSportsEvent(item, cfg)
          if (normalized) all.push(normalized)
        }
      } catch (e) {
        errors.push(String(e.message || e))
      }
    }
  }
  const seen = new Set()
  const deduped = all.filter(e => {
    const key = e.id || `${e.sport}-${e.home}-${e.away}-${e.event_time}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => new Date(a.event_time) - new Date(b.event_time))
  return { events: deduped, errors, apisChecked: chosen.map(x => x.key), days }
}

function cacheRowFromEventV1695(ev, days = 2) {
  const eventTime = ev?.event_time || ev?.commence_time || ev?.kickoff_time
  if (!ev?.home || !ev?.away || !eventTime) return null
  const eventMs = Date.parse(eventTime)
  if (!Number.isFinite(eventMs)) return null
  const expiresHours = Number(process.env.SPORTS_FIXTURE_CACHE_TTL_HOURS || 8)
  return {
    cache_key: String(ev.id || `${ev.sport || 'sport'}-${ev.home}-${ev.away}-${eventTime}`).replace(/\s+/g, '-').toLowerCase(),
    sport: ev.sport || 'Piłka nożna',
    country: ev.country || '',
    league: ev.league || 'Liga',
    home: ev.home,
    away: ev.away,
    commence_time: new Date(eventMs).toISOString(),
    fixture_json: ev,
    fetched_at: nowIso(),
    expires_at: new Date(Date.now() + Math.max(1, expiresHours) * 60 * 60 * 1000).toISOString()
  }
}

async function upsertEventsToFixtureCacheV1695(supabase, events = [], days = 2, errors = []) {
  const rows = (events || []).map(ev => cacheRowFromEventV1695(ev, days)).filter(Boolean)
  if (!rows.length) return 0
  try {
    const { data, error } = await supabase
      .from('sports_fixture_cache')
      .upsert(rows, { onConflict: 'cache_key' })
      .select('cache_key')
    if (error) throw error
    return data?.length || rows.length
  } catch (error) {
    errors.push(`cache upsert: ${error?.message || error}`)
    return 0
  }
}

async function refreshFixtureCacheBeforeAiV1695(supabase, event, days, errors = []) {
  const minFreshMatches = Number(event?.queryStringParameters?.min_cache || process.env.REAL_AI_MIN_FRESH_CACHE || 25)
  const current = await fetchCachedFootballEvents(supabase, days).catch(err => {
    errors.push(`cache before refresh: ${err?.message || err}`)
    return []
  })

  if (current.length >= minFreshMatches && !['1','true','yes'].includes(String(event?.queryStringParameters?.refresh_cache || '').toLowerCase())) {
    return { events: current, cacheBefore: current.length, cacheSaved: 0, refreshed: false, apisChecked: ['sports_fixture_cache'] }
  }

  try {
    const live = await fetchAllRealEvents(event)
    const saved = await upsertEventsToFixtureCacheV1695(supabase, live.events || [], days, errors)
    const after = await fetchCachedFootballEvents(supabase, days).catch(() => current)
    return {
      events: after.length ? after : (live.events || []),
      cacheBefore: current.length,
      cacheSaved: saved,
      refreshed: true,
      apisChecked: saved > 0 ? ['api-sports-refresh', 'sports_fixture_cache'] : (live.apisChecked || ['api-sports'])
    }
  } catch (error) {
    errors.push(`api refresh: ${error?.message || error}`)
    return { events: current, cacheBefore: current.length, cacheSaved: 0, refreshed: false, apisChecked: current.length ? ['sports_fixture_cache'] : [] }
  }
}



function normalizeOddNumberV1699(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? round(n, 2) : 0
}

function isAllowedFootballGoalsLineV1700(selection) {
  const text = String(selection || '').toLowerCase()
  const line = Number((text.match(/(\d+(?:[.,]\d+)?)/)?.[1] || '').replace(',', '.'))
  if (!Number.isFinite(line)) return false

  // Bez absurdów typu over 6.5 / over 7 / dokładne dziwne total lines.
  // Zostawiamy tylko najczytelniejsze rynki główne.
  if (text.includes('powyżej') || text.includes('over')) return [1.5, 2.5, 3.5].includes(line)
  if (text.includes('poniżej') || text.includes('under')) return [2.5, 3.5].includes(line)
  return false
}

function isSaneRealOddsCandidateV1700(candidate) {
  const odds = Number(candidate?.odds || 0)
  const market = String(candidate?.market || '').toLowerCase()
  const selection = String(candidate?.selection || '').toLowerCase()

  if (!Number.isFinite(odds) || odds < REAL_AI_MIN_ODDS_V1691) return false

  // Bez hard max dla bazy, ale jako TOP typ AI nie chcemy loterii.
  // Jeżeli chcesz ostrzej/luźniej, zmień env REAL_AI_MAX_REASONABLE_ODDS.
  const maxReasonableOdds = Number(process.env.REAL_AI_MAX_REASONABLE_ODDS || 4.00)
  if (odds > maxReasonableOdds) return false

  if (market.includes('gole')) return isAllowedFootballGoalsLineV1700(selection)
  if (market.includes('podwójna')) return odds <= 2.60
  if (market.includes('1x2')) return odds <= 3.50
  if (market.includes('btts')) return odds <= 2.70
  if (market.includes('dnb')) return odds <= 2.50
  if (market.includes('handicap')) return odds <= 3.00

  return false
}


function getEventDateKeyV1699(ev) {
  const d = new Date(ev?.event_time || ev?.commence_time || ev?.kickoff_time || nowIso())
  if (!Number.isFinite(d.getTime())) return isoDate(new Date())
  return d.toISOString().slice(0, 10)
}

function getFixtureIdFromEventV1699(ev) {
  // WERSJA 1701: tylko prawdziwe ID fixture. Nie wyciągamy losowych cyfr z cache_key/nazwy.
  const raw =
    ev?.api_fixture_id ||
    ev?.external_fixture_id ||
    ev?.fixture_id ||
    ev?.apiFixtureId ||
    ev?.fixture?.id ||
    ''

  const clean = String(raw || '').trim()
  if (!/^\d{4,}$/.test(clean)) return ''
  return clean
}

function normalizeRealOddsCandidateV1699(ev, betName, valueName, odd) {
  const odds = normalizeOddNumberV1699(odd)
  if (!odds || odds < REAL_AI_MIN_ODDS_V1691) return null

  const bet = String(betName || '').trim()
  const value = String(valueName || '').trim()
  const betLower = bet.toLowerCase()
  const valueLower = value.toLowerCase()

  let market = bet
  let selection = value

  if (betLower.includes('match winner') || betLower === 'winner' || betLower.includes('1x2')) {
    market = '1X2'
    if (value === 'Home' || value === '1') selection = `${ev.home} wygra`
    else if (value === 'Away' || value === '2') selection = `${ev.away} wygra`
    else if (valueLower.includes('draw') || value === 'X') selection = 'Remis'
  } else if (betLower.includes('double chance')) {
    market = 'Podwójna szansa'
    if (value.includes('1X') || valueLower.includes('home/draw')) selection = `${ev.home} lub remis`
    else if (value.includes('X2') || valueLower.includes('draw/away')) selection = `${ev.away} lub remis`
    else if (value.includes('12') || valueLower.includes('home/away')) selection = `${ev.home} lub ${ev.away}`
  } else if (betLower.includes('goals over/under') || betLower.includes('over/under') || betLower.includes('goals')) {
    market = 'Gole'
    const line = value.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.')
    if (valueLower.includes('over') || valueLower.includes('powyżej')) selection = `Powyżej ${line || ''} gola`.trim()
    else if (valueLower.includes('under') || valueLower.includes('poniżej')) selection = `Poniżej ${line || ''} gola`.trim()
  } else if (betLower.includes('both teams score') || betLower.includes('btts')) {
    market = 'BTTS'
    if (valueLower === 'yes' || valueLower.includes('tak')) selection = 'Obie drużyny strzelą: TAK'
    else if (valueLower === 'no' || valueLower.includes('nie')) selection = 'Obie drużyny strzelą: NIE'
  } else if (betLower.includes('draw no bet')) {
    market = 'DNB / Remis nie ma zakładu'
    if (value === 'Home' || value === '1') selection = `${ev.home} DNB`
    else if (value === 'Away' || value === '2') selection = `${ev.away} DNB`
  } else if (betLower.includes('handicap')) {
    market = 'Handicap'
    selection = value
  }

  // Odrzucamy egzotyczne rynki, których nie chcemy w Typach AI.
  const allowed = ['1X2', 'Podwójna szansa', 'Gole', 'BTTS', 'DNB / Remis nie ma zakładu', 'Handicap']
  if (!allowed.includes(market)) return null

  const candidate = {
    market,
    selection,
    odds,
    bookmaker: '',
    rawBet: bet,
    rawValue: value
  }

  if (!isSaneRealOddsCandidateV1700(candidate)) return null

  return {
    market,
    selection,
    odds,
    bookmaker: '',
    rawBet: bet,
    rawValue: value
  }
}

function probabilityForRealOddsCandidateV1699(ev, candidate) {
  // WERSJA 1700: prawdopodobieństwo musi wynikać z realnego kursu.
  // Nie wolno dawać 64% dla kursu 19.00, bo to robi absurdalne EV.
  const seed = hashNumber(`${ev.id}-${ev.home}-${ev.away}-${ev.league}-${candidate.market}-${candidate.selection}`)
  const odds = Number(candidate?.odds || 0)
  if (!Number.isFinite(odds) || odds <= 1) return 0

  const implied = (1 / odds) * 100
  const modelEdge = 2 + (seed % 9) // 2-10 pp przewagi modelowej, ostrożnie
  let p = implied + modelEdge

  const m = String(candidate.market || '').toLowerCase()
  if (m.includes('podwójna')) p += 2
  else if (m.includes('gole')) p += 1
  else if (m.includes('1x2')) p -= 1
  else if (m.includes('handicap')) p -= 2

  // Im wyższy kurs, tym bardziej ograniczamy optymizm.
  if (odds >= 3.00) p = Math.min(p, 46)
  else if (odds >= 2.50) p = Math.min(p, 50)
  else if (odds >= 2.00) p = Math.min(p, 57)
  else if (odds >= 1.70) p = Math.min(p, 64)
  else if (odds >= 1.50) p = Math.min(p, 76)

  return clamp(round(p, 1), 1, 82)
}

function scoreRealOddsCandidateV1699(ev, candidate) {
  const probability = probabilityForRealOddsCandidateV1699(ev, candidate)
  const implied = round((1 / candidate.odds) * 100, 2)
  const value = round(probability - implied, 2)
  const confidence = clamp(round(probability + Math.max(0, value) * 0.35, 1), 40, 88)
  const aiScore = clamp(round(confidence * 0.78 + Math.max(0, value) * 1.5, 2), 0, 96)
  return {
    ...candidate,
    probability,
    implied,
    value,
    confidence,
    aiScore,
    risk: confidence >= 74 ? 'medium' : 'high'
  }
}

async function fetchFootballOddsByDateV1699(date, errors = []) {
  if (!API_SPORTS_KEY) return []
  const host = 'https://v3.football.api-sports.io'
  const rows = []
  let page = 1
  const maxPages = Number(process.env.REAL_ODDS_MAX_PAGES || 5)

  while (page <= maxPages) {
    const url = `${host}/odds?date=${encodeURIComponent(date)}&page=${page}`
    try {
      const res = await fetch(url, { headers: { 'x-apisports-key': API_SPORTS_KEY } })
      const body = await res.text()
      let data = null
      try { data = JSON.parse(body) } catch { data = null }

      const apiErrors = data?.errors && typeof data.errors === 'object' ? data.errors : null
      if (!res.ok || (apiErrors && Object.keys(apiErrors).length)) {
        const msg = apiErrors && Object.keys(apiErrors).length ? JSON.stringify(apiErrors) : body.slice(0, 300)
        errors.push(`odds ${date} page ${page}: ${res.status} ${msg}`)
        break
      }

      const response = Array.isArray(data?.response) ? data.response : []
      rows.push(...response)

      const paging = data?.paging || {}
      const total = Number(paging.total || 1)
      const current = Number(paging.current || page)
      if (!response.length || current >= total) break
      page += 1
    } catch (error) {
      errors.push(`odds ${date}: ${error?.message || error}`)
      break
    }
  }

  return rows
}

async function buildRealFootballOddsMapV1699(events = [], errors = []) {
  const footballEvents = (events || []).filter(ev => String(ev?.sport || '').toLowerCase().includes('piłka') || String(ev?.sport_key || '').includes('football'))
  const dates = [...new Set(footballEvents.map(getEventDateKeyV1699).filter(Boolean))]
  const map = new Map()

  for (const date of dates) {
    const oddsRows = await fetchFootballOddsByDateV1699(date, errors)
    for (const row of oddsRows) {
      const fixtureId = String(row?.fixture?.id || row?.fixture_id || row?.id || '')
      if (!fixtureId) continue
      const candidates = []
      const bookmakers = Array.isArray(row?.bookmakers) ? row.bookmakers : []
      for (const bookmaker of bookmakers) {
        const bets = Array.isArray(bookmaker?.bets) ? bookmaker.bets : []
        for (const bet of bets) {
          const values = Array.isArray(bet?.values) ? bet.values : []
          for (const value of values) {
            candidates.push({
              betName: bet?.name,
              valueName: value?.value,
              odd: value?.odd,
              bookmaker: bookmaker?.name || ''
            })
          }
        }
      }
      if (candidates.length) map.set(String(fixtureId), candidates)
    }
  }

  return map
}

function chooseRealApiOddsPickV1699(ev, oddsMap) {
  const fixtureId = getFixtureIdFromEventV1699(ev)
  const rawCandidates = fixtureId ? (oddsMap.get(String(fixtureId)) || []) : []
  const scored = rawCandidates
    .map(c => {
      const normalized = normalizeRealOddsCandidateV1699(ev, c.betName, c.valueName, c.odd)
      if (!normalized) return null
      normalized.bookmaker = c.bookmaker || normalized.bookmaker || 'API-Football Odds'
      normalized.api_fixture_id = fixtureId
      const scored = scoreRealOddsCandidateV1699(ev, normalized)
      scored.rawBet = normalized.rawBet
      scored.rawValue = normalized.rawValue
      scored.api_fixture_id = fixtureId
      return scored
    })
    .filter(Boolean)
    .filter(c => isSaneRealOddsCandidateV1700(c))
    .filter(c => Number(c.odds || 0) >= REAL_AI_MIN_ODDS_V1691)

  if (!scored.length) return null

  scored.sort((a, b) => {
    const evDiff = Number(b.value || 0) - Number(a.value || 0)
    if (Math.abs(evDiff) > 0.01) return evDiff
    return Number(b.aiScore || 0) - Number(a.aiScore || 0)
  })

  return scored[0]
}

function chooseModelPick(ev) {
  const seed = hashNumber(`${ev.id}-${ev.home}-${ev.away}-${ev.league}`)
  const homeLean = (seed % 100) >= 45
  const isDrawSport = /piłka nożna|hokej|rugby/i.test(ev.sport)
  const liveBoost = ev.status === 'live' ? 4 : 0
  let probability = 58 + (seed % 15) + liveBoost
  let market = 'Zwycięzca meczu'
  let selection = homeLean ? `${ev.home} wygra` : `${ev.away} wygra`

  if (ev.sport === 'Piłka nożna') {
    const variant = seed % 5
    if (variant === 0) { market = 'Podwójna szansa'; selection = homeLean ? `${ev.home} lub remis` : `${ev.away} lub remis`; probability += 8 }
    else if (variant === 1) { market = 'Gole'; selection = 'Powyżej 1.5 gola'; probability += 6 }
    else if (variant === 2) { market = 'Gole'; selection = 'Poniżej 3.5 gola'; probability += 5 }
  } else if (/koszykówka|nba|baseball|siatkówka|piłka ręczna|nfl|afl/i.test(ev.sport)) {
    market = 'Moneyline'
  } else if (/mma/i.test(ev.sport)) {
    market = 'Zwycięzca walki'
  } else if (/hokej|rugby/i.test(ev.sport) && isDrawSport) {
    market = 'Double chance / bezpieczny kierunek'
    selection = homeLean ? `${ev.home} nie przegra` : `${ev.away} nie przegra`
    probability += 5
  }

  probability = clamp(probability, 48, 79)
  const odds = round(100 / probability * 1.04, 2)
  const implied = round((1 / odds) * 100, 2)
  const value = round(probability - implied, 2)
  const confidence = clamp(round(probability + Math.max(0, value) * 0.35, 1), 55, 88)
  const aiScore = clamp(round(confidence * 0.78 + Math.max(0, value) * 1.5, 2), 0, 96)
  return { market, selection, odds, implied, probability: round(probability, 1), value, confidence, aiScore, risk: confidence >= 74 ? 'medium' : 'high' }
}

function buildBaseAnalysis(ev, pick) {
  return `Realne wydarzenie z API-Sports: ${ev.match_name || `${ev.home} vs ${ev.away}`} (${ev.sport}, ${ev.league}). Model Bet+AI wybiera rynek: ${pick.market}, typ: ${pick.selection}. Prawdopodobieństwo modelowe ${pick.probability}%, szacowany kurs ${pick.odds}, implied ${pick.implied}%, value ${pick.value} pp. To jest analiza modelowa bez gwarancji wyniku; typ wymaga sprawdzenia kursu u bukmachera przed grą.`
}

async function polishWithOpenAI(row, baseAnalysis) {
  if (!OPENAI_API_KEY) return baseAnalysis
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Jesteś analitykiem sportowym. Pisz po polsku, krótko, konkretnie. Nie obiecuj zysku i nie udawaj, że znasz dane których nie dostałeś.' },
          { role: 'user', content: baseAnalysis }
        ],
        temperature: 0.2,
        max_tokens: 150
      })
    })
    if (!res.ok) return baseAnalysis
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || baseAnalysis
  } catch { return baseAnalysis }
}

async function buildRow(ev, realOddsMap = new Map()) {
  const realPick = chooseRealApiOddsPickV1699(ev, realOddsMap)
  if (!realPick && process.env.REAL_AI_ALLOW_SYNTHETIC_ODDS !== '1') return null
  const pick = realPick || chooseModelPick(ev)
  const matchName = `${ev.home} vs ${ev.away}`
  const base = {
    ai_external_key: `daily-ai-${ev.sport}-${ev.external_fixture_id}-${String(ev.event_time || '').slice(0,10)}-${pick.market}-${pick.selection}`.replace(/\s+/g, '-').toLowerCase(),
    external_fixture_id: ev.external_fixture_id,
    league_id: null,
    author_name: 'BetAI MultiSport AI',
    league: ev.league,
    league_name: ev.league,
    sport: ev.sport,
    country: ev.country || null,
    team_home: ev.home,
    team_away: ev.away,
    match_name: matchName,
    bet_type: pick.market,
    market: pick.market,
    selection: pick.selection,
    pick: pick.selection,
    odds: pick.odds,
    implied_probability: pick.implied,
    model_probability: pick.probability,
    probability: pick.probability,
    value_score: pick.value,
    ai_confidence: pick.confidence,
    ai_score: pick.aiScore,
    risk_level: pick.risk,
    bookmaker: pick.bookmaker || 'API-Football Odds',
    odds_bookmaker: pick.bookmaker || 'API-Football Odds',
    odds_raw_market: pick.rawBet || pick.market || '',
    odds_raw_value: pick.rawValue || pick.selection || '',
    odds_api_fixture_id: pick.api_fixture_id || ev.api_fixture_id || ev.external_fixture_id || '',
    event_time: ev.event_time,
    kickoff_time: ev.event_time,
    match_time: ev.event_time,
    live_minute: 0,
    live_score_home: ev.live_score_home ?? null,
    live_score_away: ev.live_score_away ?? null,
    live_status: ev.rawStatus || ev.status,
    status: ev.status,
    result: 'pending',
    profit: 0,
    source: [
      '1701-real-api-football-odds-fixture-id-debug',
      row.odds_bookmaker ? `bookmaker=${row.odds_bookmaker}` : '',
      row.odds_raw_market ? `raw_market=${row.odds_raw_market}` : '',
      row.odds_raw_value ? `raw_value=${row.odds_raw_value}` : '',
      row.odds_api_fixture_id ? `fixture=${row.odds_api_fixture_id}` : ''
    ].filter(Boolean).join('|'),
    ai_source: 'real_ai_engine',
    ai_model_version: '1700-real-api-football-odds-sane-markets',
    access_type: pick.confidence >= 82 ? 'premium' : 'free',
    is_premium: pick.confidence >= 82,
    price: pick.confidence >= 82 ? 9 : 0,
    created_at: nowIso()
  }
  const analysis = await polishWithOpenAI(base, buildBaseAnalysis({ ...ev, match_name: matchName }, pick))
  return { ...base, analysis, ai_analysis: analysis }
}


function toIsoDateTime(value) {
  const d = new Date(value || nowIso())
  if (Number.isNaN(d.getTime())) return nowIso()
  return d.toISOString()
}

function aiBetRowFromStrongestRow(row) {
  const iso = toIsoDateTime(row.event_time || row.match_time || row.kickoff_time || row.created_at)
  const home = safeName(row.team_home || row.home_team || row.home, 'Home')
  const away = safeName(row.team_away || row.away_team || row.away, 'Away')
  const market = safeName(row.market || row.bet_type, 'Typ AI')
  const prediction = safeName(row.selection || row.pick || row.prediction, 'Predykcja AI')
  const externalBase = row.external_fixture_id || row.ai_external_key || `${home}-${away}-${iso.slice(0,10)}-${market}-${prediction}`
  return {
    external_fixture_id: String(externalBase),
    match_date: iso.slice(0, 10),
    match_time: iso.slice(11, 16),
    home_team: home,
    away_team: away,
    country: safeName(row.country, 'API-Sports'),
    league: safeName(row.league || row.league_name, 'Liga'),
    market,
    prediction,
    odds: round(Number(row.odds || 0), 2),
    probability: round(row.probability || row.model_probability || row.ai_confidence || 70, 2),
    ev: round(row.ev || row.value_score || 0, 2),
    ai_score: round(row.ai_score || row.aiScore || row.ai_confidence || row.probability || row.model_probability || 70, 2),
    status: 'pending',
    result: null,
    profit: 0,
    source: '1701-real-api-football-odds-fixture-id-debug',
    updated_at: nowIso()
  }
}

async function saveRowsToAiBets(supabase, strongestRows, errors) {
  let aiBetsSaved = 0
  const ids = []
  for (const sourceRow of strongestRows) {
    const row = aiBetRowFromStrongestRow(sourceRow)
    try {
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
        const settled = ['won', 'lost', 'void', 'push', 'win', 'loss'].includes(String(existing?.[0]?.status || existing?.[0]?.result || '').toLowerCase())
        const updateRow = settled
          ? Object.fromEntries(Object.entries(row).filter(([key]) => !['status', 'result', 'profit'].includes(key)))
          : row
        const { data, error } = await supabase
          .from('ai_bets')
          .update(updateRow)
          .eq('id', existingId)
          .select('id')
          .single()
        if (error) throw error
        ids.push(data?.id || existingId)
      } else {
        const { data, error } = await supabase
          .from('ai_bets')
          .insert({ ...row, created_at: nowIso() })
          .select('id')
          .single()
        if (error) throw error
        ids.push(data?.id)
      }
      aiBetsSaved += 1
    } catch (error) {
      errors.push(`ai_bets save ${row.home_team} vs ${row.away_team}: ${error?.message || error}`)
    }
  }
  return { aiBetsSaved, ids }
}

exports.handler = async function (event) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing Supabase env: SUPABASE_URL/VITE_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const days = clamp(Number(event?.queryStringParameters?.days || process.env.REAL_AI_LOOKAHEAD_DAYS || 1), 1, 14)
    let events = []
    let errors = []
    let apisChecked = []
    let cacheBefore = 0
    let cacheSaved = 0
    let cacheRefreshed = false

    const refreshed = await refreshFixtureCacheBeforeAiV1695(supabase, event, days, errors)
    events = refreshed.events || []
    apisChecked = refreshed.apisChecked || []
    cacheBefore = refreshed.cacheBefore || 0
    cacheSaved = refreshed.cacheSaved || 0
    cacheRefreshed = !!refreshed.refreshed
    // V1673: days=2 oznacza tylko dziś + jutro według Polski, nie ruchome 48h,
    // które potrafiło dopisać mecze z pojutrza do Mecze Result jako PENDING.
    const allowedDates = allowedWarsawDateKeys(days)
    events = events.filter(ev => isEventInAllowedWarsawDays(ev, allowedDates))
    const maxPicks = Number(event?.queryStringParameters?.limit || process.env.REAL_AI_MAX_PICKS_PER_SCAN || 20)
    const minProbability = Number(process.env.REAL_AI_MIN_PROBABILITY || 48)
    const minValueScore = Number(process.env.REAL_AI_MIN_VALUE_SCORE || -99)
    const realOddsMap = await buildRealFootballOddsMapV1699(events, errors)
    const rows = []
    for (const ev of events.slice(0, Number(process.env.REAL_MATCHES_LIMIT || 80))) {
      try {
        const row = await buildRow(ev, realOddsMap)
        if (!row) {
          errors.push(`skip ${ev.home} vs ${ev.away}: brak realnego kursu API-Football dla dozwolonych rynków`)
          continue
        }
        if (Number(row.odds || 0) < REAL_AI_MIN_ODDS_V1691) continue
        if (Number(row.model_probability || row.probability || 0) < minProbability) continue
        if (Number(row.value_score || 0) < minValueScore) continue
        row.quality_label = row.ai_score >= 78 ? 'TOP AI' : row.ai_score >= 70 ? 'VALUE' : 'REAL EVENT'
        rows.push(row)
      } catch (e) {
        errors.push(`skip ${ev.id}: ${e.message || e}`)
      }
    }
    const strongestRows = rows.sort((a, b) => Number(b.ai_score || 0) - Number(a.ai_score || 0)).slice(0, maxPicks)
    if (!strongestRows.length) {
      return json(200, { inserted: 0, matches_checked: events.length, apis_checked: apisChecked, days, cache_before: cacheBefore, cache_saved: cacheSaved, cache_refreshed: cacheRefreshed, message: 'API-Sports działa, ale nie znaleziono realnych wydarzeń albo wszystkie zostały odfiltrowane.', errors: errors.slice(0, 12) })
    }

    const { aiBetsSaved, ids: aiBetIds } = await saveRowsToAiBets(supabase, strongestRows, errors)

    // Zachowujemy stary zapis do tips dla kompatybilności innych ekranów, ale Typy AI czytają z ai_bets.
    // V1673: tabela tips ma część pól integer, więc zaokrąglamy procenty, żeby nie było błędów typu "77.1".
    const tipsRows = strongestRows.map(row => ({
      ...row,
      probability: Math.round(Number(row.probability || row.model_probability || 0)),
      model_probability: Math.round(Number(row.model_probability || row.probability || 0)),
      ai_score: Math.round(Number(row.ai_score || row.ai_confidence || row.model_probability || 0)),
      ai_confidence: Math.round(Number(row.ai_confidence || row.ai_score || row.model_probability || 0))
    }))
    let tipsSaved = 0
    try {
      const { data, error } = await supabase.from('tips').upsert(tipsRows, { onConflict: 'ai_external_key' }).select('id,status')
      if (error) throw error
      tipsSaved = data?.length || strongestRows.length
    } catch (upsertError) {
      for (const row of tipsRows) {
        try {
          const { data: existing, error: findTipError } = await supabase
            .from('tips')
            .select('id,status,result')
            .eq('ai_external_key', row.ai_external_key)
            .limit(1)
          if (findTipError) throw findTipError
          const existingId = existing?.[0]?.id
          if (existingId) {
            const settled = ['won','lost','void','win','loss'].includes(String(existing?.[0]?.status || existing?.[0]?.result || '').toLowerCase())
            const updateRow = settled ? Object.fromEntries(Object.entries(row).filter(([k]) => !['status','result','profit'].includes(k))) : row
            const { error } = await supabase.from('tips').update(updateRow).eq('id', existingId)
            if (error) throw error
          } else {
            const { error } = await supabase.from('tips').insert(row)
            if (error) throw error
          }
          tipsSaved += 1
        } catch (rowError) {
          errors.push(`tips save ${row.match_name}: ${rowError.message || rowError}`)
        }
      }
    }

    try {
      await supabase.from('ai_pick_runs').insert({
        source: '1701-real-api-football-odds-fixture-id-debug',
        picks_created: aiBetsSaved,
        status: aiBetsSaved > 0 ? 'success' : 'error',
        error_message: errors.length ? errors.slice(0, 12).join(' | ').slice(0, 1000) : null,
        finished_at: nowIso()
      })
    } catch (_) {}

    return json(200, {
      inserted: aiBetsSaved,
      ai_bets_inserted: aiBetsSaved,
      tips_inserted: tipsSaved,
      ai_bet_ids: aiBetIds,
      matches_checked: events.length,
      apis_checked: apisChecked,
      days,
      cache_before: cacheBefore,
      cache_saved: cacheSaved,
      cache_refreshed: cacheRefreshed,
      real_odds_fixtures: realOddsMap?.size || 0,
      real_odds_fixtures: realOddsMap?.size || 0,
      candidates: rows.length,
      model: '1701-real-api-football-odds-fixture-id-debug',
      message: 'Skan AI używa realnych kursów z API-Football odds tylko po prawdziwym fixture ID. Source zawiera bookmaker/raw_market/raw_value/fixture debug.'
      warnings: errors.slice(0, 12)
    })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'MultiSport AI Engine error' })
  }
}
