const { createClient } = require('@supabase/supabase-js')

const VERSION = '48-cichy-brann-odds-1-20-repair'
const CORRECT_ODDS = 1.20

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

function unifiedStatus(tip = {}) {
  return normalize(tip.status || tip.result || tip.settlement_status || tip.result_status || '')
}

function isTargetTipV48(tip = {}) {
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
  const homeMatches = home === 'brannii' || home === 'brann2' || home.includes('brannii') || home.includes('brann2')
  if (!homeMatches || !away.includes('stord')) return false

  const betText = normalize([
    tip.bet_type,
    tip.prediction,
    tip.pick,
    tip.selection,
    tip.market,
    tip.market_name,
    tip.tip
  ].filter(Boolean).join(' ')).replace(/,/g, '.')

  const isOver = betText.includes('powyzej') || betText.includes('over')
  const isLine15 = /(?:^|\D)1(?:[._\s-]?5)(?:\D|$)/.test(betText) || betText.includes('1.5')
  const mentionsHome = betText.includes('brann') || betText.includes('gospodarz') || betText.includes('home')
  if (!isOver || !isLine15 || !mentionsHome) return false

  const status = unifiedStatus(tip)
  if (['won', 'win', 'lost', 'loss', 'lose', 'void', 'push', 'cancelled', 'canceled'].includes(status)) return false

  const kickoffRaw = String(tip.match_time || tip.event_time || tip.kickoff_time || tip.start_time || tip.kickoff || '')
  if (kickoffRaw && !kickoffRaw.includes('2026-08-03')) {
    const parsed = Date.parse(kickoffRaw)
    if (Number.isFinite(parsed)) {
      const iso = new Date(parsed).toISOString().slice(0, 10)
      if (iso !== '2026-08-03') return false
    }
  }

  return true
}

async function updateTipOdds(supabase, tip) {
  const now = new Date().toISOString()
  let payload = { odds: CORRECT_ODDS, course: CORRECT_ODDS, updated_at: now }
  const removedColumns = []

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('tips')
      .update(payload)
      .eq('id', tip.id)
      .select('*')
      .maybeSingle()

    if (!error) return { data, removedColumns }

    const message = String(error.message || error)
    const missing = message.match(/Could not find the '([^']+)' column/i)?.[1]
      || message.match(/'([^']+)' column of 'tips'/i)?.[1]

    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      delete payload[missing]
      removedColumns.push(missing)
      continue
    }

    throw error
  }

  throw new Error('Nie udało się zapisać poprawionego kursu po kilku próbach')
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }

  try {
    const supabase = getSupabase()
    const { data: tips, error } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1500)

    if (error) throw error

    const matches = (Array.isArray(tips) ? tips : []).filter(isTargetTipV48)
    const changed = []
    const alreadyCorrect = []

    for (const tip of matches) {
      const oldOdds = numeric(tip.odds ?? tip.course)
      if (Math.abs(oldOdds - CORRECT_ODDS) < 0.0001) {
        alreadyCorrect.push({ id: tip.id, odds: oldOdds })
        continue
      }

      const result = await updateTipOdds(supabase, tip)
      changed.push({
        id: tip.id,
        author: tip.author_name || tip.username || 'cichy1981r',
        match: `${tip.team_home || tip.home_team || 'Brann II'} - ${tip.team_away || tip.away_team || 'Stord'}`,
        pick: tip.bet_type || tip.prediction || tip.pick || 'Brann II powyżej 1.5 gola',
        old_odds: oldOdds,
        new_odds: CORRECT_ODDS,
        removed_columns: result.removedColumns
      })
    }

    return json(200, {
      ok: true,
      version: VERSION,
      target: 'cichy1981r · Brann II - Stord · Brann II powyżej 1.5 gola',
      correct_odds: CORRECT_ODDS,
      matched: matches.length,
      updated: changed.length,
      already_correct: alreadyCorrect.length,
      changed,
      message: changed.length
        ? 'Kurs został poprawiony w tabeli tips. Dashboard, profil typera i późniejsze rozliczenie użyją kursu 1.20.'
        : alreadyCorrect.length
          ? 'Kurs był już poprawiony na 1.20.'
          : 'Nie znaleziono dokładnego oczekującego typu do poprawy.'
    })
  } catch (error) {
    console.error('repair-cichy-brann-odds-v48 error:', error)
    return json(500, { ok: false, version: VERSION, error: error.message || String(error) })
  }
}

exports.__test = { isTargetTipV48 }
