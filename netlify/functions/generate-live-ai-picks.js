const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
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
function warsawTimeHHMM(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(d.getTime())) return '12:00'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.hour || '12'}:${parts.minute || '00'}`
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

function cachedFixtureToAiEvent(fx) {
  if (!fx?.home || !fx?.away || !fx?.commence_time) return null
  const eventMs = Date.parse(fx.commence_time)
  if (!Number.isFinite(eventMs) || eventMs <= Date.now()) return null
  const id = fx.apiFixtureId || fx.id
  return {
    id: `football-${id}`,
    external_fixture_id: Number(String(id || '').replace(/\D/g, '').slice(0, 12)) || hashNumber(`football-${id}`),
    sport: fx.sport || 'Piłka nożna',
    sport_key: 'football',
    league: fx.league || 'Piłka nożna',
    country: fx.country || '',
    home: fx.home,
    away: fx.away,
    event_time: fx.commence_time,
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
    .select('fixture_json')
    .gt('expires_at', now.toISOString())
    .gt('commence_time', now.toISOString())
    .lt('commence_time', end.toISOString())
    .order('commence_time', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data || []).map(row => cachedFixtureToAiEvent(row?.fixture_json)).filter(Boolean)
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

  probability = clamp(probability, 57, 79)
  const odds = round(clamp(100 / probability * 1.04, 1.32, 2.25), 2)
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

async function buildRow(ev) {
  const pick = chooseModelPick(ev)
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
    bookmaker: 'Model AI / sprawdź kurs u bukmachera',
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
    source: 'live_ai_engine',
    ai_source: 'real_ai_engine',
    ai_model_version: '737-free-apisports-only',
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
    match_date: warsawDateKey(iso),
    match_time: warsawTimeHHMM(iso),
    home_team: home,
    away_team: away,
    country: safeName(row.country, 'API-Sports'),
    league: safeName(row.league || row.league_name, 'Liga'),
    market,
    prediction,
    odds: round(row.odds || 1.5, 2),
    probability: round(row.probability || row.model_probability || row.ai_confidence || 70, 2),
    ev: round(row.ev || row.value_score || 0, 2),
    ai_score: round(row.ai_score || row.aiScore || row.ai_confidence || row.probability || row.model_probability || 70, 2),
    status: 'pending',
    result: null,
    profit: 0,
    source: '1086-daily-stable-scan-ai-bets-fixed',
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
    try {
      events = await fetchCachedFootballEvents(supabase, days)
      if (events.length) apisChecked = ['sports_fixture_cache']
    } catch (cacheError) {
      errors.push(`cache: ${cacheError.message || cacheError}`)
    }
    if (!events.length) {
      const live = await fetchAllRealEvents(event)
      events = live.events
      errors = errors.concat(live.errors || [])
      apisChecked = live.apisChecked
    }
    // V1673: days=2 oznacza tylko dziś + jutro według Polski, nie ruchome 48h,
    // które potrafiło dopisać mecze z pojutrza do Mecze Result jako PENDING.
    const allowedDates = allowedWarsawDateKeys(days)
    events = events.filter(ev => isEventInAllowedWarsawDays(ev, allowedDates))
    const maxPicks = Number(event?.queryStringParameters?.limit || process.env.REAL_AI_MAX_PICKS_PER_SCAN || 20)
    // V1676: oficjalne Typy AI: prawdopodobieństwo 60-100% oraz kurs minimum 1.40, bez górnego limitu kursu.
    const minProbability = Number(event?.queryStringParameters?.minProbability || process.env.REAL_AI_MIN_PROBABILITY || 60)
    const minOdds = Number(event?.queryStringParameters?.minOdds || process.env.REAL_AI_MIN_ODDS || 1.4)
    const minValueScore = Number(process.env.REAL_AI_MIN_VALUE_SCORE || -99)
    const rows = []
    for (const ev of events.slice(0, Number(process.env.REAL_MATCHES_LIMIT || 80))) {
      try {
        const row = await buildRow(ev)
        if (Number(row.model_probability || row.probability || 0) < minProbability) continue
        if (Number(row.odds || 0) < minOdds) continue
        if (Number(row.value_score || 0) < minValueScore) continue
        row.quality_label = row.ai_score >= 78 ? 'TOP AI' : row.ai_score >= 70 ? 'VALUE' : 'REAL EVENT'
        rows.push(row)
      } catch (e) {
        errors.push(`skip ${ev.id}: ${e.message || e}`)
      }
    }
    const strongestRows = rows.sort((a, b) => Number(b.ai_score || 0) - Number(a.ai_score || 0)).slice(0, maxPicks)
    if (!strongestRows.length) {
      return json(200, { inserted: 0, matches_checked: events.length, apis_checked: apisChecked, days, message: 'API-Sports działa, ale nie znaleziono realnych wydarzeń albo wszystkie zostały odfiltrowane.', errors: errors.slice(0, 12) })
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
        source: '1086-daily-stable-scan-ai-bets-fixed',
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
      candidates: rows.length,
      model: '1086-daily-stable-scan-ai-bets-v1676-min60-odds140-nolimit',
      min_probability: minProbability,
      min_odds: minOdds,
      message: 'Skan AI zapisuje TOP typy do ai_bets. V1676: tylko dziś+jutro według Europe/Warsaw, prawdopodobieństwo 60-100%, kurs min. 1.40, bez górnego limitu kursu.',
      warnings: errors.slice(0, 12)
    })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'MultiSport AI Engine error' })
  }
}
