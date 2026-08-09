const { createClient } = require('@supabase/supabase-js')

const VERSION = '54-manual-slavia-dashboard-profile-repair'
const CORRECT_HOME = 'SK Slavia Praha'
const CORRECT_AWAY = 'FK Pardubice'
const CORRECT_MATCH = `${CORRECT_HOME} vs ${CORRECT_AWAY}`
const CORRECT_MARKET = 'Wynik 1. połowy'
const CORRECT_PICK = `${CORRECT_HOME} wygra 1. połowę`
const CORRECT_ODDS = 1.57
const CORRECT_STAKE = 100

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
}

function json(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body, null, 2) } }
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}
function norm(value) {
  return String(value == null ? '' : value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function num(value) { const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0 }
function missingColumn(error) {
  const message = String(error?.message || error || '')
  return message.match(/Could not find the '([^']+)' column/i)?.[1]
    || message.match(/'([^']+)' column of 'tips'/i)?.[1]
    || message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i)?.[1] || ''
}
function kickoffDay(row = {}) {
  const raw = row.match_time || row.event_time || row.kickoff_time || row.commence_time || ''
  const ts = Date.parse(String(raw || ''))
  return Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : ''
}
function isTarget(row = {}) {
  const event = norm([row.match,row.match_name,row.team_home,row.team_away,row.home_team,row.away_team].filter(Boolean).join(' '))
  if (!event.includes('slavia praha') || !event.includes('pardubice')) return false
  const day = kickoffDay(row)
  if (day && day !== '2026-08-09') return false
  const author = norm([row.author_name,row.username,row.author_email,row.email].filter(Boolean).join(' '))
  const pick = norm([row.bet_type,row.prediction,row.pick,row.selection,row.market,row.market_name].filter(Boolean).join(' '))
  const fingerprint = pick.includes('manchester city') || Math.abs(num(row.odds ?? row.course) - 1.72) < 0.001 || Math.abs(num(row.stake) - 1000) < 0.001
  return fingerprint && (author.includes('smilytv') || !author)
}
async function updateOne(supabase, row) {
  let payload = {
    league: '1. Liga', league_name: '1. Liga', competition: '1. Liga',
    match: CORRECT_MATCH, match_name: CORRECT_MATCH,
    team_home: CORRECT_HOME, team_away: CORRECT_AWAY, home_team: CORRECT_HOME, away_team: CORRECT_AWAY,
    market: CORRECT_MARKET, market_name: CORRECT_MARKET,
    market_key: 'manual', selection_key: 'manual_home_first_half_win', settlement_mode: 'manual_admin_review',
    bet_market_type: CORRECT_MARKET, stats_bet_type: CORRECT_MARKET, type_label: CORRECT_MARKET, pick_type: CORRECT_MARKET, selection_type: CORRECT_MARKET,
    bet_type: CORRECT_PICK, prediction: CORRECT_PICK, pick: CORRECT_PICK, selection: CORRECT_PICK,
    odds: CORRECT_ODDS, course: CORRECT_ODDS, stake: CORRECT_STAKE,
    tip_source: 'manual_visible_admin_settlement', settlement_source: 'manual_visible_admin_settlement', ai_source: 'user_manual',
    status: 'pending', settlement_status: 'pending', manual_settlement_status: 'none', admin_approval_status: 'none', manual_settlement_result: null,
    updated_at: new Date().toISOString()
  }
  const removed=[]
  for (let attempt=0; attempt<36; attempt++) {
    const { data, error } = await supabase.from('tips').update(payload).eq('id', row.id).select('*').maybeSingle()
    if (!error) return { data, removed }
    const missing = missingColumn(error)
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) { delete payload[missing]; removed.push(missing); continue }
    throw error
  }
  throw new Error('Nie udało się zapisać korekty rekordu')
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('tips').select('*').order('created_at', { ascending: false }).limit(5000)
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    const matches = rows.filter(isTarget)
    const changed=[]
    for (const row of matches) {
      const before = { id:row.id, author_name:row.author_name, match:row.match, team_home:row.team_home, team_away:row.team_away, market:row.market, bet_type:row.bet_type, prediction:row.prediction, odds:row.odds, stake:row.stake, match_time:row.match_time }
      const out = await updateOne(supabase,row)
      changed.push({ before, after:out.data, removed_columns:out.removed })
    }
    return json(200,{ ok:true, version:VERSION, matched:matches.length, updated:changed.length,
      target:`${CORRECT_MATCH} · ${CORRECT_PICK} · kurs ${CORRECT_ODDS} · stawka ${CORRECT_STAKE}`,
      changed,
      message: matches.length ? 'Naprawiono rekord. Dashboard i Mój profil pokażą teraz poprawny typ po odświeżeniu.' : 'Nie znaleziono rekordu do korekty.' })
  } catch (error) {
    console.error('repair-smilytv-slavia-manual-v54 error:',error)
    return json(500,{ ok:false, version:VERSION, error:error.message || String(error) })
  }
}

exports.__test = { isTarget, norm, kickoffDay }
