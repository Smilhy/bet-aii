const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

const AUTHOR_NAME = 'BetAI MultiSport AI'
const AUTHOR_USERNAME = 'betai-multisport-ai'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }
}

function n(value, fallback = 0) {
  const x = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(x) ? x : fallback
}

function clean(value, fallback = '') {
  const s = String(value == null ? '' : value).trim()
  return s || fallback
}

function toDateKey(value) {
  const raw = clean(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function toTime(value) {
  const raw = clean(value)
  const m = raw.match(/(\d{1,2}):(\d{2})/)
  if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
  return '12:00'
}

function plusDays(days) {
  const d = new Date(Date.now() + Number(days || 0) * 86400000)
  return d.toISOString().slice(0, 10)
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function compact(value) {
  return norm(value).replace(/[^a-z0-9]+/g, '')
}

function inferKeysFromBet(row) {
  const market = clean(row.market || row.market_name || row.bet_type)
  const prediction = clean(row.prediction || row.selection || row.pick || row.bet_type)
  const text = compact(`${market} ${prediction}`)
  const home = clean(row.home_team || row.team_home || row.home)
  const away = clean(row.away_team || row.team_away || row.away)
  const homeC = compact(home)
  const awayC = compact(away)

  if (text.includes('lubremis') || text.includes('podwojnaszansa') || text.includes('doublechance')) {
    if (homeC && text.includes(homeC)) return { market_key: 'double_chance', selection_key: '1x' }
    if (awayC && text.includes(awayC)) return { market_key: 'double_chance', selection_key: 'x2' }
    if (text.includes('1x')) return { market_key: 'double_chance', selection_key: '1x' }
    if (text.includes('x2')) return { market_key: 'double_chance', selection_key: 'x2' }
    if (text.includes('12')) return { market_key: 'double_chance', selection_key: '12' }
  }

  if (text.includes('powyzej') || text.includes('over')) {
    const line = String(prediction || market).replace(',', '.').match(/(\d+(?:\.\d+)?)/)?.[1] || ''
    return { market_key: 'goals_over_under', selection_key: line ? `over_${line.replace('.', '_')}` : '' }
  }
  if (text.includes('ponizej') || text.includes('under')) {
    const line = String(prediction || market).replace(',', '.').match(/(\d+(?:\.\d+)?)/)?.[1] || ''
    return { market_key: 'goals_over_under', selection_key: line ? `under_${line.replace('.', '_')}` : '' }
  }
  if (text.includes('obiedruzynystrzela') || text.includes('btts')) {
    return { market_key: 'btts', selection_key: (text.includes('nie') || text.includes('no')) ? 'no' : 'yes' }
  }
  if (text.includes('wygra') || text.includes('winner') || text.includes('matchwinner')) {
    if (homeC && text.includes(homeC)) return { market_key: 'match_winner', selection_key: 'home' }
    if (awayC && text.includes(awayC)) return { market_key: 'match_winner', selection_key: 'away' }
  }

  return {
    market_key: clean(row.market_key || row.marketKey),
    selection_key: clean(row.selection_key || row.selectionKey)
  }
}

function buildTipRowFromAiBet(bet) {
  const home = clean(bet.home_team || bet.team_home || bet.home, 'Home')
  const away = clean(bet.away_team || bet.team_away || bet.away, 'Away')
  const market = clean(bet.market || bet.bet_type || 'Typ AI')
  const prediction = clean(bet.prediction || bet.selection || bet.pick || bet.bet_type, market)
  const date = toDateKey(bet.match_date || bet.event_date || bet.event_time || bet.match_time || bet.kickoff_time)
  const time = toTime(bet.match_time || bet.event_time || bet.kickoff_time || bet.match_date)
  const external = clean(bet.external_fixture_id || bet.api_fixture_id || bet.fixture_id || bet.odds_api_fixture_id || `${home}-${away}-${market}-${prediction}-${date}-${time}`)
  const keys = inferKeysFromBet({ ...bet, home_team: home, away_team: away, market, prediction })
  const now = new Date().toISOString()
  const odds = Math.max(1.01, n(bet.odds || bet.course, 1.5))
  const stake = Math.max(1, n(process.env.BETAI_MULTISPORT_AI_STAKE || bet.stake, 1))

  return {
    ai_external_key: `betai-multisport-ai|${external}|${market}|${prediction}`,
    external_fixture_id: external,
    api_fixture_id: clean(bet.api_fixture_id || bet.fixture_id || bet.odds_api_fixture_id || external).replace(/\D/g, '') || null,
    fixture_id: clean(bet.fixture_id || bet.api_fixture_id || bet.odds_api_fixture_id || external).replace(/\D/g, '') || null,
    sport: clean(bet.sport, 'Piłka nożna'),
    sport_key: clean(bet.sport_key, 'football'),
    country: clean(bet.country, 'API-Sports'),
    league: clean(bet.league || bet.league_name, 'Piłka nożna'),
    match_name: `${home} vs ${away}`,
    match: `${home} vs ${away}`,
    team_home: home,
    team_away: away,
    match_date: date,
    match_time: bet.event_time || bet.kickoff_time || bet.match_time || `${date}T${time}:00Z`,
    event_time: bet.event_time || bet.kickoff_time || bet.match_time || `${date}T${time}:00Z`,
    kickoff_time: bet.kickoff_time || bet.event_time || bet.match_time || `${date}T${time}:00Z`,
    market,
    bet_type: prediction,
    prediction,
    pick: prediction,
    selection: prediction,
    market_key: keys.market_key || null,
    selection_key: keys.selection_key || null,
    odds,
    stake,
    status: 'pending',
    result: 'pending',
    settlement_status: 'pending',
    result_status: 'pending',
    profit: 0,
    payout: 0,
    return_amount: 0,
    is_premium: false,
    access_type: 'free',
    coupon_type: 'single',
    is_ako: false,
    legs_count: 1,
    author_name: AUTHOR_NAME,
    username: AUTHOR_USERNAME,
    source: clean(bet.source, 'betai-multisport-ai-auto-publisher-v1726'),
    tip_source: 'betai-multisport-ai-auto-publisher-v1726',
    ai_source: 'betai-multisport-ai-auto-publisher-v1726',
    ai_score: Math.round(n(bet.ai_score || bet.ai_confidence || bet.probability || bet.model_probability, 70)),
    ai_confidence: Math.round(n(bet.ai_confidence || bet.ai_score || bet.probability || bet.model_probability, 70)),
    probability: Math.round(n(bet.probability || bet.model_probability || bet.ai_confidence || bet.ai_score, 70)),
    model_probability: Math.round(n(bet.model_probability || bet.probability || bet.ai_confidence || bet.ai_score, 70)),
    value_score: n(bet.value_score || bet.ev, 0),
    ev: n(bet.ev || bet.value_score, 0),
    bookmaker: clean(bet.bookmaker || bet.odds_bookmaker),
    odds_bookmaker: clean(bet.odds_bookmaker || bet.bookmaker),
    odds_raw_market: clean(bet.odds_raw_market),
    odds_raw_value: clean(bet.odds_raw_value),
    created_at: now,
    updated_at: now
  }
}

async function getTableColumns(supabase, tableName = 'tips') {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)

  if (!error && Array.isArray(data) && data.length) {
    return new Set(data.map(row => row.column_name))
  }

  // Fallback, gdy PostgREST nie pozwala czytać information_schema.
  // Lista zawiera kolumny potwierdzone w projekcie + najczęściej używane w tips.
  return new Set([
    'id',
    'ai_external_key',
    'external_fixture_id',
    'api_fixture_id',
    'fixture_id',
    'sport',
    'sport_key',
    'country',
    'league',
    'match_name',
    'match',
    'team_home',
    'team_away',
    'match_date',
    'match_time',
    'event_time',
    'kickoff_time',
    'market',
    'bet_type',
    'prediction',
    'pick',
    'selection',
    'market_key',
    'selection_key',
    'odds',
    'stake',
    'status',
    'result',
    'settlement_status',
    'result_status',
    'profit',
    'payout',
    'return_amount',
    'is_premium',
    'access_type',
    'coupon_type',
    'is_ako',
    'legs_count',
    'author_name',
    'username',
    'source',
    'tip_source',
    'ai_source',
    'ai_score',
    'ai_confidence',
    'probability',
    'model_probability',
    'value_score',
    'ev',
    'bookmaker',
    'odds_bookmaker',
    'odds_raw_market',
    'odds_raw_value',
    'created_at',
    'updated_at'
  ])
}

function filterExistingColumns(row, columns) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => columns.has(key))
  )
}


function missingColumnFromError(error) {
  const msg = String(error?.message || error || '')
  const m = msg.match(/Could not find the '([^']+)' column/i)
  return m ? m[1] : ''
}

async function insertTipRowSafe(supabase, row, tipColumns) {
  let payload = filterExistingColumns(row, tipColumns)
  const removed = []

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase.from('tips').insert(payload).select('id').single()
    if (!error) return { data, removed }

    const missing = missingColumnFromError(error)
    if (!missing || !(missing in payload)) throw error

    delete payload[missing]
    removed.push(missing)
  }

  throw new Error('Too many missing-column retries during insert: ' + removed.join(', '))
}

async function updateTipRowSafe(supabase, id, row, tipColumns) {
  let payload = filterExistingColumns(row, tipColumns)
  const removed = []

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase.from('tips').update(payload).eq('id', id).select('id').single()
    if (!error) return { data, removed }

    const missing = missingColumnFromError(error)
    if (!missing || !(missing in payload)) throw error

    delete payload[missing]
    removed.push(missing)
  }

  throw new Error('Too many missing-column retries during update: ' + removed.join(', '))
}


async function ensureAiBetsAvailable(baseUrl, days, limit, force) {
  if (!baseUrl) return { ok: false, reason: 'no_base_url' }
  const url = `${baseUrl.replace(/\/$/, '')}/.netlify/functions/generate-live-ai-picks?days=${encodeURIComponent(days)}&limit=${encodeURIComponent(limit)}${force ? '&refresh_cache=1' : ''}`
  try {
    const res = await fetch(url, { method: 'GET' })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch (error) {
    return { ok: false, reason: error.message || String(error) }
  }
}

exports.config = { schedule: process.env.BETAI_MULTISPORT_AI_CRON || '17 */4 * * *' }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

  const params = event.queryStringParameters || {}
  const limit = Math.min(Math.max(Number(params.limit || process.env.BETAI_MULTISPORT_AI_LIMIT || 6), 1), 20)
  const days = Math.min(Math.max(Number(params.days || process.env.BETAI_MULTISPORT_AI_DAYS || 1), 1), 7)
  const minScore = Number(params.min_score || process.env.BETAI_MULTISPORT_AI_MIN_SCORE || 70)
  const force = ['1','true','yes'].includes(String(params.force || '').toLowerCase())
  const dryRun = ['1','true','yes'].includes(String(params.dry_run || '').toLowerCase())

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const tipColumns = await getTableColumns(supabase, 'tips')

  const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || 'https://bet-ai.app'
  const generation = await ensureAiBetsAvailable(baseUrl, days, Math.max(limit * 4, 12), force)

  const today = plusDays(0)
  const end = plusDays(days)
  const { data: aiBets, error } = await supabase
    .from('ai_bets')
    .select('*')
    .gte('match_date', today)
    .lte('match_date', end)
    .eq('status', 'pending')
    .order('ai_score', { ascending: false })
    .order('match_date', { ascending: true })
    .limit(Math.max(limit * 5, 30))

  if (error) return json(500, { ok: false, error: error.message, generation })

  const rows = (aiBets || [])
    .filter(b => n(b.ai_score || b.ai_confidence || b.probability, 0) >= minScore)
    .map(buildTipRowFromAiBet)
    .map(row => filterExistingColumns(row, tipColumns))
    .filter(row => row.fixture_id || row.api_fixture_id || row.external_fixture_id)
    .slice(0, limit)

  if (dryRun) return json(200, { ok: true, version: '1729-betai-multisport-ai-today-only', dry_run: true, generation, candidates: rows.length, rows })

  let inserted = 0
  let updated = 0
  const errors = []
  const ids = []

  for (const row of rows) {
    try {
      const { data: existing, error: findError } = await supabase
        .from('tips')
        .select('id,status,result')
        .eq('ai_external_key', row.ai_external_key)
        .limit(1)
      if (findError) throw findError

      const existingId = existing?.[0]?.id
      if (existingId) {
        const settled = ['won','lost','void','win','loss'].includes(String(existing?.[0]?.status || existing?.[0]?.result || '').toLowerCase())
        const updateRow = settled
          ? Object.fromEntries(Object.entries(row).filter(([key]) => !['status','result','settlement_status','result_status','profit','payout','return_amount','created_at'].includes(key)))
          : Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'created_at'))
        const { data } = await updateTipRowSafe(supabase, existingId, updateRow, tipColumns)
        ids.push(data?.id || existingId)
        updated++
      } else {
        const { data } = await insertTipRowSafe(supabase, row, tipColumns)
        ids.push(data?.id)
        inserted++
      }
    } catch (error) {
      errors.push({ match: row.match_name, pick: row.prediction, error: error.message || String(error) })
    }
  }

  try {
    await supabase.from('ai_pick_runs').insert({
      source: 'betai-multisport-ai-publisher-v1729',
      picks_created: inserted,
      status: errors.length ? 'partial' : 'success',
      error_message: errors.length ? JSON.stringify(errors).slice(0, 1000) : null,
      finished_at: new Date().toISOString()
    })
  } catch (_) {}

  return json(errors.length && !inserted && !updated ? 500 : 200, {
    ok: !errors.length || inserted > 0 || updated > 0,
    version: '1729-betai-multisport-ai-today-only',
    author: AUTHOR_NAME,
    inserted,
    updated,
    attempted: rows.length,
    ids,
    generation,
    errors: errors.slice(0, 20)
  })
}
