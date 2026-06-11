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

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function compact(value) {
  return norm(value).replace(/[^a-z0-9]+/g, '')
}

function todayWarsaw() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function toDateKey(value) {
  const raw = clean(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return todayWarsaw()
}

function toIsoOrText(date, time) {
  const d = toDateKey(date)
  const rawTime = clean(time, '12:00')
  if (/^\d{1,2}:\d{2}$/.test(rawTime)) return `${d}T${rawTime.padStart(5, '0')}:00Z`
  const parsed = new Date(rawTime)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return `${d}T12:00:00Z`
}

function inferKeys(row) {
  const market = clean(row.market || row.market_name || row.bet_type)
  const prediction = clean(row.prediction || row.selection || row.pick || row.bet_type)
  const home = clean(row.home_team || row.team_home || row.home)
  const away = clean(row.away_team || row.team_away || row.away)
  const text = compact(`${market} ${prediction}`)
  const homeC = compact(home)
  const awayC = compact(away)

  if (clean(row.market_key) || clean(row.selection_key)) {
    return { market_key: clean(row.market_key), selection_key: clean(row.selection_key) }
  }

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

  if (text.includes('wygra') || text.includes('winner')) {
    if (homeC && text.includes(homeC)) return { market_key: 'match_winner', selection_key: 'home' }
    if (awayC && text.includes(awayC)) return { market_key: 'match_winner', selection_key: 'away' }
  }

  return { market_key: '', selection_key: '' }
}

function buildTipRow(aiBet) {
  const home = clean(aiBet.home_team || aiBet.team_home || aiBet.home, 'Home')
  const away = clean(aiBet.away_team || aiBet.team_away || aiBet.away, 'Away')
  const market = clean(aiBet.market || aiBet.bet_type || 'Typ AI')
  const prediction = clean(aiBet.prediction || aiBet.selection || aiBet.pick || aiBet.bet_type, market)
  const matchDate = toDateKey(aiBet.match_date)
  const kickoff = toIsoOrText(matchDate, aiBet.match_time || aiBet.kickoff_time || aiBet.event_time)
  const external = clean(aiBet.external_fixture_id || aiBet.api_fixture_id || aiBet.fixture_id || aiBet.odds_api_fixture_id || `${home}-${away}-${market}-${prediction}-${matchDate}`)
  const fixtureDigits = clean(aiBet.api_fixture_id || aiBet.fixture_id || aiBet.external_fixture_id || external).replace(/\D/g, '')
  const keys = inferKeys({ ...aiBet, home_team: home, away_team: away, market, prediction })
  const now = new Date().toISOString()
  const odds = Math.max(1.01, n(aiBet.odds || aiBet.course, 1.5))
  const stake = Math.max(1, n(process.env.BETAI_MULTISPORT_AI_STAKE, 1))

  return {
    ai_external_key: `betai-multisport-ai|${external}|${market}|${prediction}`,
    external_fixture_id: external,
    api_fixture_id: fixtureDigits || null,
    fixture_id: fixtureDigits || null,
    author_name: AUTHOR_NAME,
    username: AUTHOR_USERNAME,
    sport: clean(aiBet.sport, 'Piłka nożna'),
    sport_key: clean(aiBet.sport_key, 'football'),
    country: clean(aiBet.country, 'API-Sports'),
    league: clean(aiBet.league || aiBet.league_name, 'Piłka nożna'),
    match_name: `${home} vs ${away}`,
    match: `${home} vs ${away}`,
    team_home: home,
    team_away: away,
    match_date: matchDate,
    match_time: kickoff,
    event_time: kickoff,
    kickoff_time: kickoff,
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
    source: 'betai-multisport-ai-only-publisher-v1730',
    tip_source: 'betai-multisport-ai-only-publisher-v1730',
    ai_source: 'betai-multisport-ai-only-publisher-v1730',
    ai_score: Math.round(n(aiBet.ai_score || aiBet.ai_confidence || aiBet.probability || aiBet.model_probability, 70)),
    ai_confidence: Math.round(n(aiBet.ai_confidence || aiBet.ai_score || aiBet.probability || aiBet.model_probability, 70)),
    probability: Math.round(n(aiBet.probability || aiBet.model_probability || aiBet.ai_confidence || aiBet.ai_score, 70)),
    model_probability: Math.round(n(aiBet.model_probability || aiBet.probability || aiBet.ai_confidence || aiBet.ai_score, 70)),
    value_score: n(aiBet.value_score || aiBet.ev, 0),
    ev: n(aiBet.ev || aiBet.value_score, 0),
    bookmaker: clean(aiBet.bookmaker || aiBet.odds_bookmaker),
    odds_bookmaker: clean(aiBet.odds_bookmaker || aiBet.bookmaker),
    odds_raw_market: clean(aiBet.odds_raw_market),
    odds_raw_value: clean(aiBet.odds_raw_value),
    created_at: now,
    updated_at: now
  }
}

function missingColumn(error) {
  const msg = String(error?.message || error || '')
  const m = msg.match(/Could not find the '([^']+)' column/i)
  return m ? m[1] : ''
}

async function insertTipSafe(supabase, row) {
  let payload = { ...row }
  const removed = []
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase.from('tips').insert(payload).select('id').single()
    if (!error) return { data, removed }
    const col = missingColumn(error)
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      delete payload[col]
      removed.push(col)
      continue
    }
    throw error
  }
  throw new Error('Too many missing-column retries: ' + removed.join(', '))
}

async function updateTipSafe(supabase, id, row) {
  let payload = { ...row }
  delete payload.created_at
  const removed = []
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase.from('tips').update(payload).eq('id', id).select('id').single()
    if (!error) return { data, removed }
    const col = missingColumn(error)
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      delete payload[col]
      removed.push(col)
      continue
    }
    throw error
  }
  throw new Error('Too many missing-column retries: ' + removed.join(', '))
}

exports.config = { schedule: process.env.BETAI_MULTISPORT_AI_CRON || '17 */4 * * *' }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

  const params = event.queryStringParameters || {}
  const limit = Math.min(Math.max(Number(params.limit || process.env.BETAI_MULTISPORT_AI_LIMIT || 3), 1), 10)
  const minScore = Number(params.min_score || process.env.BETAI_MULTISPORT_AI_MIN_SCORE || 70)
  const dryRun = ['1', 'true', 'yes'].includes(String(params.dry_run || '').toLowerCase())
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date || '') ? params.date : todayWarsaw()

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: aiBets, error } = await supabase
    .from('ai_bets')
    .select('*')
    .eq('match_date', date)
    .eq('status', 'pending')
    .order('ai_score', { ascending: false })
    .order('match_time', { ascending: true })
    .limit(50)

  if (error) return json(500, { ok: false, version: '1730-betai-multisport-ai-only-publisher', error: error.message })

  const candidates = (aiBets || [])
    .filter(bet => n(bet.ai_score || bet.ai_confidence || bet.probability, 0) >= minScore)
    .map(buildTipRow)
    .slice(0, limit)

  if (dryRun) {
    return json(200, { ok: true, version: '1730-betai-multisport-ai-only-publisher', dry_run: true, date, candidates: candidates.length, rows: candidates })
  }

  let inserted = 0
  let updated = 0
  const ids = []
  const errors = []
  const removedColumns = []

  for (const row of candidates) {
    try {
      const { data: existing, error: findError } = await supabase
        .from('tips')
        .select('id,status,result')
        .eq('ai_external_key', row.ai_external_key)
        .limit(1)

      if (findError) throw findError
      const existingId = existing?.[0]?.id

      if (existingId) {
        const settled = ['won', 'lost', 'void', 'win', 'loss'].includes(String(existing?.[0]?.status || existing?.[0]?.result || '').toLowerCase())
        if (settled) {
          ids.push(existingId)
          continue
        }
        const out = await updateTipSafe(supabase, existingId, row)
        ids.push(out.data?.id || existingId)
        removedColumns.push(...out.removed)
        updated++
      } else {
        const out = await insertTipSafe(supabase, row)
        ids.push(out.data?.id)
        removedColumns.push(...out.removed)
        inserted++
      }
    } catch (error) {
      errors.push({ match: row.match_name, pick: row.prediction, error: error.message || String(error) })
    }
  }

  try {
    await supabase.from('ai_pick_runs').insert({
      source: 'betai-multisport-ai-only-publisher-v1730',
      picks_created: inserted,
      status: errors.length ? 'partial' : 'success',
      error_message: errors.length ? JSON.stringify(errors).slice(0, 1000) : null,
      finished_at: new Date().toISOString()
    })
  } catch (_) {}

  return json(errors.length && !inserted && !updated ? 500 : 200, {
    ok: !errors.length || inserted > 0 || updated > 0,
    version: '1730-betai-multisport-ai-only-publisher',
    author: AUTHOR_NAME,
    date,
    source: 'existing_ai_bets_only',
    inserted,
    updated,
    attempted: candidates.length,
    ids,
    removed_columns: [...new Set(removedColumns)],
    errors: errors.slice(0, 20)
  })
}
