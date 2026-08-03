const { createClient } = require('@supabase/supabase-js')

const VERSION = '49-cichy-vaduz-stgallen-odds-result-repair'
const CORRECT_ODDS = 2.20
const CORRECT_STATUS = 'won'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }
}

function env(name) {
  return process.env[name] || ''
}

function getSupabase() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY')
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalize(value) {
  let text = String(value == null ? '' : value).trim().toLowerCase()
  const accents = { 'ą':'a', 'ć':'c', 'ę':'e', 'ł':'l', 'ń':'n', 'ó':'o', 'ś':'s', 'ź':'z', 'ż':'z' }
  let out = ''
  for (const char of text) out += accents[char] || char
  return out
}

function compact(value) {
  return normalize(value).replace(/[^a-z0-9]/g, '')
}

function numeric(value) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function getStake(tip = {}) {
  return numeric(tip.stake ?? tip.amount ?? tip.bet_amount ?? tip.units ?? 0)
}

function isTargetTipV49(tip = {}) {
  const author = compact([
    tip.author_name,
    tip.username,
    tip.user_name,
    tip.public_slug,
    tip.author_slug,
    tip.author_email,
    tip.email
  ].filter(Boolean).join(' '))
  if (!author.includes('cichy1981r')) return false

  const home = compact(tip.team_home || tip.home_team || tip.home || '')
  const away = compact(tip.team_away || tip.away_team || tip.away || '')
  const homeOk = home.includes('fcvaduz') || home === 'vaduz' || home.includes('vaduz')
  const awayOk = away.includes('fcstgallen') || away.includes('stgallen') || away.includes('saintgallen')
  if (!homeOk || !awayOk) return false

  const betText = normalize([
    tip.bet_type,
    tip.prediction,
    tip.pick,
    tip.selection,
    tip.market,
    tip.market_name,
    tip.tip
  ].filter(Boolean).join(' ')).replace(/,/g, '.')

  const mentionsAway = betText.includes('st. gallen') || betText.includes('st gallen') || betText.includes('stgallen') || betText.includes('gosc') || betText.includes('away')
  const isOver = betText.includes('powyzej') || betText.includes('over')
  const isLine15 = /(?:^|\D)1(?:[._\s-]?5)(?:\D|$)/.test(betText) || betText.includes('1.5')
  if (!mentionsAway || !isOver || !isLine15) return false

  const kickoffRaw = String(tip.match_time || tip.event_time || tip.kickoff_time || tip.start_time || tip.kickoff || '')
  if (kickoffRaw) {
    const parsed = Date.parse(kickoffRaw)
    if (Number.isFinite(parsed)) {
      const date = new Date(parsed).toISOString().slice(0, 10)
      if (date !== '2026-08-02') return false
    } else if (!kickoffRaw.includes('2026-08-02') && !kickoffRaw.includes('02.08.2026')) {
      return false
    }
  }

  return true
}

function missingColumn(error) {
  const message = String(error?.message || error || '')
  return message.match(/Could not find the '([^']+)' column/i)?.[1]
    || message.match(/'([^']+)' column of 'tips'/i)?.[1]
    || ''
}

async function updateTip(supabase, tip) {
  const stake = getStake(tip)
  const profit = Math.round((stake * (CORRECT_ODDS - 1)) * 100) / 100
  const payout = Math.round((stake * CORRECT_ODDS) * 100) / 100
  const now = new Date().toISOString()

  let payload = {
    odds: CORRECT_ODDS,
    course: CORRECT_ODDS,
    status: CORRECT_STATUS,
    result: CORRECT_STATUS,
    settlement_status: CORRECT_STATUS,
    result_status: CORRECT_STATUS,
    profit,
    profit_amount: profit,
    result_profit: profit,
    payout,
    return_amount: payout,
    settlement_reason: 'Ręczna korekta kursu Team Total: FC St. Gallen powyżej 1.5 gola, kurs 2.20, typ wygrany.',
    settlement_note: 'V49: poprawiono błędny kurs 4.00 na 2.20 i zachowano prawidłowy wynik wygrany.',
    settlement_source: 'manual_repair_v49',
    settled_at: tip.settled_at || now,
    updated_at: now
  }
  const removedColumns = []

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabase
      .from('tips')
      .update(payload)
      .eq('id', tip.id)
      .select('*')
      .maybeSingle()

    if (!error) return { data, removedColumns, stake, profit, payout }

    const missing = missingColumn(error)
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      delete payload[missing]
      removedColumns.push(missing)
      continue
    }

    throw error
  }

  throw new Error('Nie udało się zapisać korekty po usunięciu nieobsługiwanych kolumn')
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }

  try {
    const supabase = getSupabase()
    const { data: tips, error } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2500)

    if (error) throw error

    const matches = (Array.isArray(tips) ? tips : []).filter(isTargetTipV49)
    const changed = []
    const alreadyCorrect = []

    for (const tip of matches) {
      const stake = getStake(tip)
      const expectedProfit = Math.round((stake * (CORRECT_ODDS - 1)) * 100) / 100
      const expectedPayout = Math.round((stake * CORRECT_ODDS) * 100) / 100
      const oldOdds = numeric(tip.odds ?? tip.course)
      const oldProfit = numeric(tip.profit ?? tip.profit_amount ?? tip.result_profit)
      const statusText = normalize(tip.status || tip.result || tip.settlement_status || tip.result_status || '')

      const correct = Math.abs(oldOdds - CORRECT_ODDS) < 0.0001
        && Math.abs(oldProfit - expectedProfit) < 0.01
        && ['won', 'win', 'wygrany'].includes(statusText)

      if (correct) {
        alreadyCorrect.push({ id: tip.id, odds: oldOdds, profit: oldProfit, stake })
        continue
      }

      const result = await updateTip(supabase, tip)
      changed.push({
        id: tip.id,
        author: tip.author_name || tip.username || 'cichy1981r',
        match: `${tip.team_home || tip.home_team || 'FC Vaduz'} - ${tip.team_away || tip.away_team || 'FC St. Gallen'}`,
        pick: tip.bet_type || tip.prediction || tip.pick || 'FC St. Gallen powyżej 1.5 gola',
        old_odds: oldOdds,
        new_odds: CORRECT_ODDS,
        old_status: statusText || null,
        new_status: CORRECT_STATUS,
        stake: result.stake,
        old_profit: oldProfit,
        new_profit: result.profit,
        payout: result.payout,
        removed_columns: result.removedColumns
      })
    }

    return json(200, {
      ok: true,
      version: VERSION,
      target: 'cichy1981r · FC Vaduz - FC St. Gallen · FC St. Gallen powyżej 1.5 gola',
      correct_odds: CORRECT_ODDS,
      correct_status: CORRECT_STATUS,
      matched: matches.length,
      updated: changed.length,
      already_correct: alreadyCorrect.length,
      changed,
      message: changed.length
        ? 'Kurs, wynik, profit i wypłata zostały poprawione. Statystyki profilu oraz ranking przeliczą się z tabeli tips po odświeżeniu.'
        : alreadyCorrect.length
          ? 'Ten typ był już poprawiony na kurs 2.20 i wynik wygrany.'
          : 'Nie znaleziono dokładnego typu cichy1981r do poprawy.'
    })
  } catch (error) {
    console.error('repair-cichy-vaduz-stgallen-v49 error:', error)
    return json(500, { ok: false, version: VERSION, error: error.message || String(error) })
  }
}

exports.__test = { isTargetTipV49, getStake }
