const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const API_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY

const AUTHOR_NAME = 'BetAI MultiSport AI'
const VERSION = '1734-betai-multisport-ai-own-engine-int-score-fix'
const SOURCE = 'live_ai_engine'

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body, null, 2) }
}
function n(value, fallback = 0) {
  const x = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(x) ? x : fallback
}
function round(value, digits = 2) {
  const f = 10 ** digits
  return Math.round(n(value, 0) * f) / f
}
function intn(value, fallback = 0) {
  const x = n(value, fallback)
  return Math.round(Number.isFinite(x) ? x : fallback)
}

function clean(value, fallback = '') {
  const s = String(value == null ? '' : value).trim()
  return s || fallback
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, n(v, 0))) }
function todayWarsaw(offset = 0) {
  const base = new Date()
  base.setUTCDate(base.getUTCDate() + Number(offset || 0))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(base).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function hashNumber(input) {
  const s = String(input || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h >>> 0)
}
function isFuture(iso, minutes = 10) {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) && ms > Date.now() + Number(minutes || 0) * 60 * 1000
}
function statusIsPreMatch(short, long) {
  const s = String(short || long || '').toLowerCase()
  return !s || ['ns', 'tbd'].includes(s) || s.includes('not started') || s.includes('scheduled') || s.includes('time to be defined')
}

async function apiGet(path, query = {}) {
  if (!API_KEY) throw new Error('Missing APISPORTS_KEY / API_FOOTBALL_KEY')
  const url = new URL(`https://v3.football.api-sports.io${path}`)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v) !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), { headers: { 'x-apisports-key': API_KEY } })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  const errors = data?.errors && typeof data.errors === 'object' ? data.errors : null
  if (!res.ok || (errors && Object.keys(errors).length)) {
    const msg = errors && Object.keys(errors).length ? JSON.stringify(errors) : text.slice(0, 300)
    throw new Error(`${path} ${res.status}: ${msg}`)
  }
  return Array.isArray(data?.response) ? data.response : []
}

function normalizeFixture(row) {
  const fixture = row?.fixture || {}
  const teams = row?.teams || {}
  const league = row?.league || {}
  const id = fixture?.id
  const date = fixture?.date
  const home = teams?.home?.name
  const away = teams?.away?.name
  if (!id || !date || !home || !away) return null
  if (!statusIsPreMatch(fixture?.status?.short, fixture?.status?.long)) return null
  return {
    fixture_id: String(id),
    external_fixture_id: String(id),
    api_fixture_id: String(id),
    match_date: String(date).slice(0, 10),
    match_time: new Date(date).toISOString(),
    kickoff_time: new Date(date).toISOString(),
    event_time: new Date(date).toISOString(),
    home,
    away,
    league: clean(league?.name, 'Piłka nożna'),
    country: clean(league?.country, ''),
    sport: 'Piłka nożna',
    sport_key: 'football'
  }
}

async function fetchFixtures(days, minMinutes, errors) {
  const all = []
  for (let i = 0; i < days; i++) {
    const date = todayWarsaw(i)
    try {
      const rows = await apiGet('/fixtures', { date })
      for (const row of rows) {
        const ev = normalizeFixture(row)
        if (ev && isFuture(ev.event_time, minMinutes)) all.push(ev)
      }
    } catch (e) {
      errors.push(`fixtures ${date}: ${e.message || e}`)
    }
  }
  const seen = new Set()
  return all.filter(ev => {
    if (seen.has(ev.fixture_id)) return false
    seen.add(ev.fixture_id)
    return true
  }).sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time))
}

function normalizeMarket(betName, valueName, odd, ev) {
  const odds = round(odd, 2)
  if (!Number.isFinite(odds) || odds < 1.40 || odds > 4.00) return null
  const bet = clean(betName).toLowerCase()
  const valRaw = clean(valueName)
  const val = valRaw.toLowerCase()
  let market = ''
  let prediction = ''
  let market_key = ''
  let selection_key = ''

  if (['double chance', 'fulltime double chance', 'double chance full time'].includes(bet)) {
    market = 'Podwójna szansa'
    market_key = 'double_chance'
    if (val === '1x' || val === 'home/draw') { prediction = `${ev.home} lub remis`; selection_key = '1x' }
    else if (val === 'x2' || val === 'draw/away') { prediction = `${ev.away} lub remis`; selection_key = 'x2' }
    else if (val === '12' || val === 'home/away') { prediction = `${ev.home} lub ${ev.away}`; selection_key = '12' }
  } else if (['goals over/under', 'over/under', 'total goals', 'match goals', 'goals'].includes(bet)) {
    const line = val.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.')
    if (!['1.5', '2.5', '3.5'].includes(line)) return null
    market = 'Gole'
    market_key = 'goals_over_under'
    if (val.startsWith('over')) { prediction = `Powyżej ${line} gola`; selection_key = `over_${line.replace('.', '_')}` }
    else if (val.startsWith('under')) { prediction = `Poniżej ${line} gola`; selection_key = `under_${line.replace('.', '_')}` }
  } else if (['both teams score', 'both teams to score', 'btts'].includes(bet)) {
    market = 'BTTS'
    market_key = 'btts'
    if (val === 'yes') { prediction = 'Obie drużyny strzelą: TAK'; selection_key = 'yes' }
    else if (val === 'no') { prediction = 'Obie drużyny strzelą: NIE'; selection_key = 'no' }
  } else if (['match winner', 'fulltime result', 'full time result', '1x2', 'result'].includes(bet)) {
    market = '1X2'
    market_key = 'match_winner'
    if (val === 'home' || val === '1') { prediction = `${ev.home} wygra`; selection_key = 'home' }
    else if (val === 'away' || val === '2') { prediction = `${ev.away} wygra`; selection_key = 'away' }
    else if (val === 'draw' || val === 'x') { prediction = 'Remis'; selection_key = 'draw' }
  }

  if (!market || !prediction) return null

  const implied = round((1 / odds) * 100, 2)
  const seed = hashNumber(`${ev.fixture_id}-${market}-${prediction}`)
  let probability = implied + 2 + (seed % 8)
  if (market_key === 'double_chance') probability += 2
  if (odds >= 3.0) probability = Math.min(probability, 46)
  else if (odds >= 2.5) probability = Math.min(probability, 50)
  else if (odds >= 2.0) probability = Math.min(probability, 57)
  else if (odds >= 1.7) probability = Math.min(probability, 64)
  else probability = Math.min(probability, 76)
  probability = clamp(round(probability, 1), 45, 82)
  const evValue = round(probability - implied, 2)
  const aiScore = clamp(round(probability * 0.82 + Math.max(0, evValue) * 1.6, 2), 0, 96)

  return { market, prediction, odds, market_key, selection_key, probability, implied, ev: evValue, ai_score: aiScore }
}

async function fetchOddsMap(dates, errors) {
  const map = new Map()
  for (const date of dates) {
    let page = 1
    const maxPages = Number(process.env.BETAI_MULTISPORT_AI_ODDS_MAX_PAGES || 5)
    while (page <= maxPages) {
      try {
        const rows = await apiGet('/odds', { date, page })
        for (const row of rows) {
          const fixtureId = String(row?.fixture?.id || '')
          if (!fixtureId) continue
          const raw = []
          for (const bookmaker of Array.isArray(row?.bookmakers) ? row.bookmakers : []) {
            for (const bet of Array.isArray(bookmaker?.bets) ? bookmaker.bets : []) {
              for (const value of Array.isArray(bet?.values) ? bet.values : []) {
                raw.push({ betName: bet?.name, valueName: value?.value, odd: value?.odd, bookmaker: bookmaker?.name || '' })
              }
            }
          }
          if (raw.length) map.set(fixtureId, raw)
        }
        if (!rows.length) break
        page++
      } catch (e) {
        errors.push(`odds ${date} page ${page}: ${e.message || e}`)
        break
      }
    }
  }
  return map
}

function chooseSyntheticPick(ev) {
  const seed = hashNumber(`${ev.fixture_id}-${ev.home}-${ev.away}-${ev.league}`)
  let market = 'Podwójna szansa'
  let prediction = seed % 2 ? `${ev.home} lub remis` : `${ev.away} lub remis`
  let market_key = 'double_chance'
  let selection_key = seed % 2 ? '1x' : 'x2'
  if (seed % 4 === 0) { market = 'Gole'; prediction = 'Powyżej 1.5 gola'; market_key = 'goals_over_under'; selection_key = 'over_1_5' }
  if (seed % 5 === 0) { market = 'Gole'; prediction = 'Poniżej 3.5 gola'; market_key = 'goals_over_under'; selection_key = 'under_3_5' }
  const probability = 61 + (seed % 12)
  const odds = round((100 / probability) * 1.03, 2)
  const implied = round((1 / odds) * 100, 2)
  const evValue = round(probability - implied, 2)
  const aiScore = clamp(round(probability * 0.82 + Math.max(0, evValue) * 1.4, 2), 0, 90)
  return { market, prediction, odds, market_key, selection_key, probability, implied, ev: evValue, ai_score: aiScore, synthetic: true }
}

function bestPickForEvent(ev, oddsMap, allowSynthetic) {
  const raw = oddsMap.get(String(ev.fixture_id)) || []
  const picks = raw.map(x => normalizeMarket(x.betName, x.valueName, x.odd, ev)).filter(Boolean)
  picks.sort((a, b) => (b.ev - a.ev) || (b.ai_score - a.ai_score))
  if (picks[0]) return picks[0]
  return allowSynthetic ? chooseSyntheticPick(ev) : null
}

function buildTipRow(ev, pick) {
  const now = new Date().toISOString()
  return {
    ai_external_key: `betai-multisport-ai-own|${ev.fixture_id}|${pick.market}|${pick.prediction}`.replace(/\s+/g, '-').toLowerCase(),
    external_fixture_id: ev.external_fixture_id,
    api_fixture_id: ev.api_fixture_id,
    fixture_id: ev.fixture_id,

    author_name: AUTHOR_NAME,
    username: null,
    user_id: null,

    sport: ev.sport,
    sport_key: ev.sport_key,
    country: ev.country,
    league: ev.league,
    match_name: `${ev.home} vs ${ev.away}`,
    match: `${ev.home} vs ${ev.away}`,
    team_home: ev.home,
    team_away: ev.away,
    match_date: ev.match_date,
    match_time: ev.match_time,
    event_time: ev.event_time,
    kickoff_time: ev.kickoff_time,

    market: pick.market,
    bet_type: pick.prediction,
    prediction: pick.prediction,
    pick: pick.prediction,
    selection: pick.prediction,
    market_key: pick.market_key,
    selection_key: pick.selection_key,

    odds: pick.odds,
    stake: 1,
    status: 'pending',
    result: null,
    settlement_status: 'pending',
    result_status: null,
    profit: 0,
    payout: 0,
    return_amount: 0,

    is_premium: false,
    access_type: 'free',
    coupon_type: 'single',
    is_ako: false,
    legs_count: 1,

    source: SOURCE,
    tip_source: null,
    ai_source: VERSION,
    ai_model_version: VERSION,
    ai_score: round(pick.ai_score, 2),
    ai_confidence: round(pick.ai_score, 2),
    probability: round(pick.probability, 2),
    model_probability: round(pick.probability, 2),
    value_score: round(pick.ev, 2),
    ev: round(pick.ev, 2),
    analysis: `BetAI MultiSport AI: ${ev.home} vs ${ev.away}. Typ: ${pick.prediction}, rynek: ${pick.market}, kurs ${pick.odds}, prawdopodobieństwo modelowe ${round(pick.probability, 1)}%.`,

    created_at: now,
    updated_at: now
  }
}

function missingColumn(error) {
  const msg = String(error?.message || error || '')
  const m = msg.match(/Could not find the '([^']+)' column/i)
  return m ? m[1] : ''
}
async function insertSafe(supabase, row) {
  let payload = { ...row }
  const removed = []
  for (let attempt = 0; attempt < 35; attempt++) {
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
async function updateSafe(supabase, id, row) {
  let payload = { ...row }
  delete payload.created_at
  const removed = []
  for (let attempt = 0; attempt < 35; attempt++) {
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
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, version: VERSION, error: 'Missing SUPABASE_URL or SERVICE ROLE KEY' })

  const q = event.queryStringParameters || {}
  const dryRun = ['1', 'true', 'yes'].includes(String(q.dry_run || '').toLowerCase())
  const limit = Math.min(Math.max(Number(q.limit || process.env.BETAI_MULTISPORT_AI_LIMIT || 3), 1), 10)
  const days = Math.min(Math.max(Number(q.days || process.env.BETAI_MULTISPORT_AI_LOOKAHEAD_DAYS || 2), 1), 7)
  const minMinutes = Math.max(Number(q.min_minutes_before_start || process.env.BETAI_MULTISPORT_AI_MIN_MINUTES_BEFORE_START || 10), 0)
  const minScore = Number(q.min_score || process.env.BETAI_MULTISPORT_AI_MIN_SCORE || 0)
  const allowSynthetic = !['0', 'false', 'no'].includes(String(q.allow_synthetic || process.env.BETAI_MULTISPORT_AI_ALLOW_SYNTHETIC || '1').toLowerCase())

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const errors = []

  const fixtures = await fetchFixtures(days, minMinutes, errors)
  const dates = [...new Set(fixtures.map(x => x.match_date).filter(Boolean))]
  const oddsMap = await fetchOddsMap(dates, errors)

  const rows = fixtures.map(ev => {
    const pick = bestPickForEvent(ev, oddsMap, allowSynthetic)
    if (!pick) return null
    const row = buildTipRow(ev, pick)
    return row.ai_score >= minScore ? row : null
  }).filter(Boolean)
    .sort((a, b) => Number(b.value_score || 0) - Number(a.value_score || 0) || Number(b.ai_score || 0) - Number(a.ai_score || 0))
    .slice(0, limit)

  if (dryRun) {
    return json(200, {
      ok: true,
      version: VERSION,
      dry_run: true,
      engine: 'own_api_football_engine_no_ai_bets',
      author: AUTHOR_NAME,
      days,
      min_minutes_before_start: minMinutes,
      fixtures_found: fixtures.length,
      odds_fixtures_found: oddsMap.size,
      candidates: rows.length,
      allow_synthetic: allowSynthetic,
      rows,
      errors: errors.slice(0, 20)
    })
  }

  let inserted = 0
  let updated = 0
  const ids = []
  const removedColumns = []
  const writeErrors = []

  for (const row of rows) {
    try {
      const { data: existing, error: findError } = await supabase
        .from('tips')
        .select('id,status,result')
        .eq('author_name', AUTHOR_NAME)
        .eq('ai_external_key', row.ai_external_key)
        .limit(1)
      if (findError) throw findError
      const existingId = existing?.[0]?.id
      if (existingId) {
        const out = await updateSafe(supabase, existingId, row)
        ids.push(out.data?.id || existingId)
        removedColumns.push(...out.removed)
        updated++
      } else {
        const out = await insertSafe(supabase, row)
        ids.push(out.data?.id)
        removedColumns.push(...out.removed)
        inserted++
      }
    } catch (e) {
      writeErrors.push({ match: row.match_name, prediction: row.prediction, error: e.message || String(e) })
    }
  }

  try {
    await supabase.from('ai_pick_runs').insert({
      source: VERSION,
      picks_created: inserted,
      status: writeErrors.length ? 'partial' : 'success',
      error_message: writeErrors.length ? JSON.stringify(writeErrors).slice(0, 1000) : null,
      finished_at: new Date().toISOString()
    })
  } catch (_) {}

  return json(writeErrors.length && !inserted && !updated ? 500 : 200, {
    ok: !writeErrors.length || inserted > 0 || updated > 0,
    version: VERSION,
    engine: 'own_api_football_engine_no_ai_bets',
    author: AUTHOR_NAME,
    source: SOURCE,
    days,
    min_minutes_before_start: minMinutes,
    fixtures_found: fixtures.length,
    odds_fixtures_found: oddsMap.size,
    attempted: rows.length,
    inserted,
    updated,
    ids,
    removed_columns: [...new Set(removedColumns)],
    errors: [...errors, ...writeErrors].slice(0, 30)
  })
}
