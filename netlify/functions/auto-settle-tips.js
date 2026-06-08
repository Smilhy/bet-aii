const { createClient } = require('@supabase/supabase-js')

const FINISHED = ['FT', 'AET', 'PEN']
const VOIDED = ['CANC', 'ABD', 'AWD', 'WO', 'PST']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }
}

function env(name) { return process.env[name] || '' }

function getSupabase() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY')
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function getApiKey() {
  return env('API_FOOTBALL_KEY') || env('API_SPORTS_KEY') || env('APISPORTS_KEY') || env('APIFOOTBALL_KEY')
}

function norm(v) {
  let s = String(v == null ? '' : v).trim().toLowerCase()
  const map = { 'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z' }
  let out = ''
  for (const ch of s) out += map[ch] || ch
  return out
}

function compact(v) {
  const s = norm(v)
  let out = ''
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) out += ch
  }
  return out
}

function toNum(v, fallback = 0) {
  const n = Number(String(v == null ? '' : v).replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function fixtureId(tip) {
  const vals = [tip.fixture_id, tip.api_fixture_id, tip.external_fixture_id, tip.fixtureId, tip.match_id, tip.matchId]
  for (const v of vals) {
    const s = String(v == null ? '' : v).trim()
    if (s && !s.startsWith('manual-')) return s
  }
  return ''
}

function textOf(tip) {
  return norm([tip.bet_type, tip.prediction, tip.market, tip.type, tip.pick].filter(Boolean).join(' '))
}

function resultOf(h, a) {
  if (h > a) return 'home'
  if (a > h) return 'away'
  return 'draw'
}

function splitUnderscore(key) {
  return String(key || '').toLowerCase().split('_').filter(Boolean)
}

function lineFromSelection(selection) {
  const parts = splitUnderscore(selection)
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p === 'minus' && i + 1 < parts.length) return -toNum(parts.slice(i + 1).join('.'), NaN)
    if (p === 'plus' && i + 1 < parts.length) return toNum(parts.slice(i + 1).join('.'), NaN)
    const n = toNum(p, NaN)
    if (Number.isFinite(n)) return n
  }
  return NaN
}

function scoreFromSelection(selection) {
  const raw = String(selection || '').trim().replace('-', ':').replace('_', ':')
  const parts = raw.split(':')
  if (parts.length !== 2) return null
  const h = Number(parts[0])
  const a = Number(parts[1])
  if (!Number.isInteger(h) || !Number.isInteger(a)) return null
  return { h, a }
}

function overUnder(selection, total, label) {
  const s = norm(selection)
  const line = lineFromSelection(s)
  if (!Number.isFinite(line)) return { status: 'pending_admin_review', reason: label + ': brak linii ' + selection }
  if (s.startsWith('over')) {
    if (total > line) return { status: 'won', reason: label + ' over ' + line + ', total=' + total }
    if (total < line) return { status: 'lost', reason: label + ' over ' + line + ', total=' + total }
    return { status: 'void', reason: label + ' push over ' + line }
  }
  if (s.startsWith('under')) {
    if (total < line) return { status: 'won', reason: label + ' under ' + line + ', total=' + total }
    if (total > line) return { status: 'lost', reason: label + ' under ' + line + ', total=' + total }
    return { status: 'void', reason: label + ' push under ' + line }
  }
  return { status: 'pending_admin_review', reason: label + ': nieznany kierunek ' + selection }
}

function statTotal(stats, kind) {
  let total = 0
  if (!Array.isArray(stats)) return 0
  for (const row of stats) {
    const arr = Array.isArray(row && row.statistics) ? row.statistics : []
    for (const st of arr) {
      const type = norm(st && st.type)
      const val = toNum(st && st.value, 0)
      if (kind === 'corners' && (type.includes('corner') || type.includes('rozny') || type.includes('rog'))) total += val
      if (kind === 'cards' && (type.includes('yellow') || type.includes('red') || type.includes('kart'))) total += val
    }
  }
  return total
}

function fallbackKeys(tip) {
  const t = textOf(tip)
  const c = compact(t)
  let market = norm(tip.market_key || tip.marketKey)
  let selection = norm(tip.selection_key || tip.selectionKey)
  if (market && selection && market !== 'unknown' && selection !== 'unknown') return { market, selection }

  const home = norm(tip.team_home)
  const away = norm(tip.team_away)

  if (c.includes('obiedruzynystrzela') || c.includes('btts')) {
    market = 'btts'
    selection = (c.includes('nie') || c.includes('no')) ? 'no' : 'yes'
  } else if (t === '1x' || t === 'x2' || t === '12' || c === '1x' || c === 'x2' || c === '12') {
    market = 'double_chance'
    selection = c
  } else if (c.includes('powyzej') || c.includes('over')) {
    market = 'goals_over_under'
    selection = 'over_' + onlyLine(t)
  } else if (c.includes('ponizej') || c.includes('under')) {
    market = 'goals_over_under'
    selection = 'under_' + onlyLine(t)
  } else if (c.includes('dnb') || c.includes('remisniemazakladu')) {
    market = 'draw_no_bet'
    selection = c.includes(compact(away)) ? 'away' : 'home'
  } else if (scoreFromSelection(t)) {
    const sc = scoreFromSelection(t)
    market = 'correct_score'
    selection = sc.h + ':' + sc.a
  } else if (c.includes('wygra')) {
    market = 'match_winner'
    selection = c.includes(compact(away)) ? 'away' : 'home'
  }
  return { market, selection }
}

function onlyLine(text) {
  const s = String(text || '').replace(',', '.')
  let out = ''
  let seenDigit = false
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    if ((code >= 48 && code <= 57) || ch === '.') { out += ch; seenDigit = true }
    else if (seenDigit) break
  }
  return out ? out.replace('.', '_') : ''
}

function settleByKeys(tip, homeGoals, awayGoals, fixtureStats) {
  const keys = fallbackKeys(tip)
  const market = norm(keys.market)
  const selection = norm(keys.selection)
  const result = resultOf(homeGoals, awayGoals)
  const total = homeGoals + awayGoals

  if (market === 'match_winner') {
    if (!['home','draw','away'].includes(selection)) return { status: 'pending_admin_review', reason: '1X2: zly selection_key=' + selection }
    return { status: selection === result ? 'won' : 'lost', reason: '1X2 ' + selection + ' wynik=' + result }
  }
  if (market === 'double_chance') {
    const won = (selection === '1x' && (result === 'home' || result === 'draw')) || (selection === 'x2' && (result === 'away' || result === 'draw')) || (selection === '12' && result !== 'draw')
    if (!['1x','x2','12'].includes(selection)) return { status: 'pending_admin_review', reason: 'Podwojna szansa: zly selection_key=' + selection }
    return { status: won ? 'won' : 'lost', reason: 'DC ' + selection + ' wynik=' + result }
  }
  if (market === 'goals_over_under' || market === 'goals_total') return overUnder(selection, total, 'Gole')
  if (market === 'btts') {
    if (!['yes','no'].includes(selection)) return { status: 'pending_admin_review', reason: 'BTTS: zly selection_key=' + selection }
    const yes = homeGoals > 0 && awayGoals > 0
    return { status: (selection === 'yes') === yes ? 'won' : 'lost', reason: 'BTTS ' + selection + ' yes=' + yes }
  }
  if (market === 'draw_no_bet') {
    if (result === 'draw') return { status: 'void', reason: 'DNB remis = zwrot' }
    return { status: selection === result ? 'won' : 'lost', reason: 'DNB ' + selection + ' wynik=' + result }
  }
  if (market === 'correct_score' || market === 'exact_score') {
    const sc = scoreFromSelection(selection)
    if (!sc) return { status: 'pending_admin_review', reason: 'Dokladny wynik: zly selection_key=' + selection }
    return { status: sc.h === homeGoals && sc.a === awayGoals ? 'won' : 'lost', reason: 'CS ' + sc.h + ':' + sc.a + ' wynik=' + homeGoals + ':' + awayGoals }
  }
  if (market === 'handicap') {
    const side = selection.startsWith('away') ? 'away' : 'home'
    const line = lineFromSelection(selection)
    if (!Number.isFinite(line)) return { status: 'pending_admin_review', reason: 'Handicap: brak linii ' + selection }
    const adjusted = side === 'home' ? homeGoals + line - awayGoals : awayGoals + line - homeGoals
    if (adjusted > 0) return { status: 'won', reason: 'Handicap ' + side + ' ' + line }
    if (adjusted < 0) return { status: 'lost', reason: 'Handicap ' + side + ' ' + line }
    return { status: 'void', reason: 'Handicap push' }
  }
  if (market === 'corners_total' || market === 'corners') return overUnder(selection, statTotal(fixtureStats, 'corners'), 'Rogi')
  if (market === 'cards_total' || market === 'cards') return overUnder(selection, statTotal(fixtureStats, 'cards'), 'Kartki')

  return { status: 'pending_admin_review', reason: 'Nieobslugiwany market_key=' + market + ' selection_key=' + selection }
}

async function fetchFixture(id) {
  const key = getApiKey()
  if (!key) throw new Error('Brak API_FOOTBALL_KEY/API_SPORTS_KEY/APISPORTS_KEY w Netlify ENV')
  const res = await fetch('https://v3.football.api-sports.io/fixtures?id=' + encodeURIComponent(id), { headers: { 'x-apisports-key': key } })
  const data = await res.json()
  const item = data && data.response && data.response[0]
  return item || null
}

async function fetchStats(id) {
  const key = getApiKey()
  if (!key) return []
  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures/statistics?fixture=' + encodeURIComponent(id), { headers: { 'x-apisports-key': key } })
    const data = await res.json()
    return Array.isArray(data && data.response) ? data.response : []
  } catch (_) { return [] }
}

function scoreFromFixture(fix) {
  const goals = fix && fix.goals ? fix.goals : {}
  const score = fix && fix.score && fix.score.fulltime ? fix.score.fulltime : {}
  const h = goals.home != null ? goals.home : score.home
  const a = goals.away != null ? goals.away : score.away
  return { h: toNum(h, 0), a: toNum(a, 0) }
}

async function settleTip(tip) {
  const id = fixtureId(tip)
  if (!id) return { status: 'skipped', reason: 'brak fixture_id' }
  const fix = await fetchFixture(id)
  if (!fix) return { status: 'skipped', reason: 'API nie zwrocilo meczu ' + id }
  const st = String((((fix.fixture || {}).status || {}).short) || '')
  if (VOIDED.includes(st)) return { status: 'void', reason: 'Mecz void status=' + st }
  if (!FINISHED.includes(st)) return { status: 'pending', reason: 'Mecz nie jest zakonczony status=' + st }
  const sc = scoreFromFixture(fix)
  const keys = fallbackKeys(tip)
  let stats = []
  if (norm(keys.market).includes('corner') || norm(keys.market).includes('card')) stats = await fetchStats(id)
  return settleByKeys(tip, sc.h, sc.a, stats)
}

function updatePayload(result) {
  const status = ['won','lost','void'].includes(result.status) ? result.status : 'pending'
  return {
    status,
    settlement_status: status,
    result_status: status,
    settlement_reason: result.reason || null,
    updated_at: new Date().toISOString()
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  const supabase = getSupabase()
  const { data: tips, error } = await supabase
    .from('tips')
    .select('*')
    .or('status.eq.pending,settlement_status.eq.pending,status.is.null,settlement_status.is.null')
    .order('created_at', { ascending: true })
    .limit(80)
  if (error) return json(500, { ok: false, error: error.message })

  const checked = []
  const settled = []
  const skipped = []
  for (const tip of (tips || [])) {
    try {
      const res = await settleTip(tip)
      checked.push({ id: tip.id, fixture_id: fixtureId(tip), result: res.status, reason: res.reason })
      if (['won','lost','void'].includes(res.status)) {
        const { error: upErr } = await supabase.from('tips').update(updatePayload(res)).eq('id', tip.id)
        if (upErr) skipped.push({ id: tip.id, reason: upErr.message })
        else settled.push({ id: tip.id, status: res.status })
      }
    } catch (e) {
      skipped.push({ id: tip.id, reason: e.message || String(e) })
    }
  }
  return json(200, { ok: true, version: '1670-no-regex-auto-settle', checked: checked.length, settled, skipped, sample: checked.slice(0, 20) })
}
