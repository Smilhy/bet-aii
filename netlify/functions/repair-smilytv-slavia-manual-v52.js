const { createClient } = require('@supabase/supabase-js')

const VERSION = '52-manual-slavia-state-repair'
const CORRECT_ODDS = 1.57
const CORRECT_HOME = 'SK Slavia Praha'
const CORRECT_AWAY = 'FK Pardubice'
const CORRECT_MATCH = `${CORRECT_HOME} vs ${CORRECT_AWAY}`
const CORRECT_MARKET = 'Wynik 1. połowy'
const CORRECT_PICK = `${CORRECT_HOME} wygra 1. połowę`

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body, null, 2) }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function norm(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
}

function num(value) {
  const n = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function isTarget(row = {}) {
  const author = norm([row.author_name, row.username, row.author_email, row.email].filter(Boolean).join(' '))
  if (!author.includes('smilytv')) return false

  const eventText = norm([row.match, row.team_home, row.team_away, row.home_team, row.away_team].filter(Boolean).join(' '))
  if (!eventText.includes('slavia praha')) return false
  if (!(eventText.includes('pardubice') || eventText.includes('rywale'))) return false

  const odds = num(row.odds ?? row.course)
  if (odds && Math.abs(odds - CORRECT_ODDS) > 0.001) return false

  const kickoff = String(row.match_time || row.event_time || row.kickoff_time || row.created_at || '')
  const parsed = Date.parse(kickoff)
  if (Number.isFinite(parsed)) {
    const d = new Date(parsed)
    const isoDay = d.toISOString().slice(0, 10)
    // Event is 09.08.2026; allow previous UTC day only if timezone conversion ever shifts around midnight.
    if (!['2026-08-08', '2026-08-09'].includes(isoDay)) return false
  }

  const pickText = norm([row.bet_type, row.prediction, row.pick, row.selection, row.market, row.market_name].filter(Boolean).join(' '))
  return pickText.includes('manchester city') || pickText.includes('1st half') || pickText.includes('1 polow') || pickText.includes('slavia')
}

function missingColumn(error) {
  const message = String(error?.message || error || '')
  return message.match(/Could not find the '([^']+)' column/i)?.[1]
    || message.match(/'([^']+)' column of 'tips'/i)?.[1]
    || ''
}

async function updateOne(supabase, row) {
  const now = new Date().toISOString()
  let payload = {
    league: '1. Liga',
    league_name: '1. Liga',
    competition: '1. Liga',
    match: CORRECT_MATCH,
    team_home: CORRECT_HOME,
    team_away: CORRECT_AWAY,
    market: CORRECT_MARKET,
    market_name: CORRECT_MARKET,
    market_key: 'manual',
    selection_key: 'manual',
    settlement_mode: 'manual_admin_review',
    bet_market_type: CORRECT_MARKET,
    stats_bet_type: CORRECT_MARKET,
    type_label: CORRECT_MARKET,
    pick_type: CORRECT_MARKET,
    selection_type: CORRECT_MARKET,
    bet_type: CORRECT_PICK,
    prediction: CORRECT_PICK,
    pick: CORRECT_PICK,
    selection: CORRECT_PICK,
    odds: CORRECT_ODDS,
    course: CORRECT_ODDS,
    tip_source: 'manual_visible_admin_settlement',
    settlement_source: 'manual_visible_admin_settlement',
    ai_source: 'user_manual',
    status: 'pending',
    settlement_status: 'pending',
    updated_at: now
  }
  const removed = []

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { data, error } = await supabase.from('tips').update(payload).eq('id', row.id).select('*').maybeSingle()
    if (!error) return { data, removed }
    const missing = missingColumn(error)
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      delete payload[missing]
      removed.push(missing)
      continue
    }
    throw error
  }
  throw new Error('Nie udało się zapisać korekty typu ręcznego')
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('tips').select('*').order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    const matches = (Array.isArray(data) ? data : []).filter(isTarget)
    const changed = []
    for (const row of matches) {
      const before = {
        id: row.id,
        match: row.match,
        home: row.team_home,
        away: row.team_away,
        market: row.market,
        bet_type: row.bet_type,
        prediction: row.prediction,
        odds: row.odds
      }
      const out = await updateOne(supabase, row)
      changed.push({ before, after: out.data, removed_columns: out.removed })
    }
    return json(200, {
      ok: true,
      version: VERSION,
      matched: matches.length,
      updated: changed.length,
      target: `smilytv · ${CORRECT_MATCH} · ${CORRECT_PICK} · ${CORRECT_ODDS}`,
      changed,
      message: matches.length
        ? 'Błędny ręczny typ został poprawiony w Supabase. Po odświeżeniu Dashboard i Mój profil pokażą prawidłowy mecz i wybór.'
        : 'Nie znaleziono pasującego błędnego typu do korekty.'
    })
  } catch (error) {
    console.error('repair-smilytv-slavia-manual-v52 error:', error)
    return json(500, { ok: false, version: VERSION, error: error.message || String(error) })
  }
}

exports.__test = { isTarget, norm }
