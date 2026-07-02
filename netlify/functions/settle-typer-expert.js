const { createClient } = require('@supabase/supabase-js')

const AUTHOR_NAME = 'Typer Expert'
const VERSION = '1881.0-typer-expert-fixture-id-recovery-v10'

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
  return norm([
    tip.bet_type,
    tip.prediction,
    tip.selection,
    tip.pick,
    tip.market,
    tip.market_name,
    tip.type,
    tip.tip,
    tip.value,
    tip.match_name
  ].filter(Boolean).join(' '))
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
  // FIX 1823:
  // Stary parser czytał "under_1_5" jako linię 1 zamiast 1.5,
  // "under_2_5" jako 2 zamiast 2.5 itd. Gdy w meczu padł dokładnie
  // 1/2/3 gole, system błędnie zapisywał ZWROT.
  const raw = norm(selection).replace(/,/g, '.')

  // Format kanoniczny używany w bazie: under_1_5, over_2_5,
  // home_minus_1_5, away_plus_0_5.
  const underscored = raw.match(/(?:^|_)(minus|plus)?_?(\d+)(?:[_.](\d+))?(?:_|$)/)
  if (underscored) {
    const sign = underscored[1] === 'minus' ? -1 : 1
    const value = Number(underscored[3]
      ? `${underscored[2]}.${underscored[3]}`
      : underscored[2])
    if (Number.isFinite(value)) return sign * value
  }

  // Format tekstowy: under 1.5 / over -1.25.
  const direct = raw.match(/[-+]?\d+(?:\.\d+)?/)
  return direct ? Number(direct[0]) : NaN
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


function teamNamesFromTip(tip) {
  const rawHome = tip.team_home || tip.home_team || tip.home || ''
  const rawAway = tip.team_away || tip.away_team || tip.away || ''
  if (rawHome || rawAway) return { home: norm(rawHome), away: norm(rawAway), homeRaw: String(rawHome || ''), awayRaw: String(rawAway || '') }

  const matchName = String(tip.match_name || tip.match || '').trim()
  const parts = matchName
    .replace(/\s+vs\s+/i, ' — ')
    .replace(/\s+v\s+/i, ' — ')
    .split(/\s+[-–—]\s+/)
    .map(x => x.trim())
    .filter(Boolean)

  return {
    home: norm(parts[0] || ''),
    away: norm(parts[1] || ''),
    homeRaw: parts[0] || '',
    awayRaw: parts[1] || ''
  }
}

function pickLooksLikeTeam(textCompact, teamName) {
  const teamCompact = compact(teamName)
  return Boolean(teamCompact && (textCompact.includes(teamCompact) || teamCompact.includes(textCompact)))
}

function inferPolishSettlementKeysV1723(tip) {
  const t = textOf(tip)
  const c = compact(t)
  const teams = teamNamesFromTip(tip)
  const home = teams.home
  const away = teams.away
  const homeC = compact(home)
  const awayC = compact(away)

  // "Serbia U19 lub remis" => 1X, "Moldova lub remis" => X2
  if (c.includes('lubremis') || c.includes('nieremis') || c.includes('podwojnaszansa')) {
    if (homeC && c.includes(homeC)) return { market: 'double_chance', selection: '1x' }
    if (awayC && c.includes(awayC)) return { market: 'double_chance', selection: 'x2' }
    if (c === '1x' || c.includes('1x')) return { market: 'double_chance', selection: '1x' }
    if (c === 'x2' || c.includes('x2')) return { market: 'double_chance', selection: 'x2' }
    if (c === '12' || c.includes('12')) return { market: 'double_chance', selection: '12' }
  }

  // "Powyżej 2.5 gola" / "Ponizej 3.5 gola"
  if (c.includes('powyzej') || c.includes('over')) {
    return { market: 'goals_over_under', selection: 'over_' + onlyLine(t) }
  }
  if (c.includes('ponizej') || c.includes('under')) {
    return { market: 'goals_over_under', selection: 'under_' + onlyLine(t) }
  }

  // "Obie drużyny strzelą: TAK/NIE"
  if (c.includes('obiedruzynystrzela') || c.includes('btts')) {
    return { market: 'btts', selection: (c.includes('nie') || c.includes('no')) ? 'no' : 'yes' }
  }

  // "Drużyna wygra"
  if (c.includes('wygra') || c.includes('win')) {
    if (homeC && c.includes(homeC)) return { market: 'match_winner', selection: 'home' }
    if (awayC && c.includes(awayC)) return { market: 'match_winner', selection: 'away' }
  }

  // Same pick as just team name.
  if (homeC && c === homeC) return { market: 'match_winner', selection: 'home' }
  if (awayC && c === awayC) return { market: 'match_winner', selection: 'away' }

  return { market: '', selection: '' }
}

function fallbackKeys(tip) {
  const t = textOf(tip)
  const c = compact(t)
  let market = norm(tip.market_key || tip.marketKey)
  let selection = norm(tip.selection_key || tip.selectionKey)

  if (market && selection && market !== 'unknown' && selection !== 'unknown') return { market, selection }

  const inferred = inferPolishSettlementKeysV1723(tip)
  if (inferred.market && inferred.selection) return inferred

  const teams = teamNamesFromTip(tip)
  const home = teams.home
  const away = teams.away

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

const fixtureByIdCache = new Map()
const fixturesByDateCache = new Map()

async function apiFootballJson(url) {
  const key = getApiKey()
  if (!key) throw new Error('Brak API_FOOTBALL_KEY/API_SPORTS_KEY/APISPORTS_KEY w Netlify ENV')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'x-apisports-key': key } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error('API-Football HTTP ' + res.status)
    if (data && data.errors && Object.keys(data.errors).length) throw new Error('API-Football: ' + JSON.stringify(data.errors))
    return Array.isArray(data && data.response) ? data.response : []
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFixture(id) {
  const key = String(id || '').trim()
  if (!key) return null
  if (!fixtureByIdCache.has(key)) {
    fixtureByIdCache.set(key, apiFootballJson('https://v3.football.api-sports.io/fixtures?id=' + encodeURIComponent(key)).then(rows => rows[0] || null))
  }
  return fixtureByIdCache.get(key)
}

async function fetchFixturesByDate(dateKey) {
  const key = String(dateKey || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return []
  if (!fixturesByDateCache.has(key)) {
    fixturesByDateCache.set(key, apiFootballJson('https://v3.football.api-sports.io/fixtures?date=' + encodeURIComponent(key)))
  }
  return fixturesByDateCache.get(key)
}

function tipDateKey(tip) {
  const values = [tip.match_time, tip.event_time, tip.kickoff_time, tip.match_date, tip.created_at]
  for (const value of values) {
    const raw = String(value == null ? '' : value).trim()
    const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    if (direct) return direct[1]
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  }
  return ''
}

function shiftDate(dateKey, days) {
  const parsed = Date.parse(String(dateKey || '') + 'T12:00:00Z')
  if (!Number.isFinite(parsed)) return ''
  return new Date(parsed + Number(days || 0) * 86400000).toISOString().slice(0, 10)
}

function namesClose(a, b) {
  const aa = compact(a)
  const bb = compact(b)
  if (!aa || !bb) return false
  if (aa === bb) return true
  return Math.min(aa.length, bb.length) >= 5 && (aa.includes(bb) || bb.includes(aa))
}

function fixtureKickoffMs(fix) {
  const raw = fix && fix.fixture && fix.fixture.date
  const parsed = Date.parse(raw || '')
  return Number.isFinite(parsed) ? parsed : 0
}

async function resolveFixtureForTip(tip) {
  const storedId = fixtureId(tip)
  if (storedId) return { id: storedId, fix: await fetchFixture(storedId), resolvedBy: 'stored_fixture_id' }

  const teams = teamNamesFromTip(tip)
  if (!teams.homeRaw || !teams.awayRaw) return { id: '', fix: null, resolvedBy: 'missing_teams' }
  const baseDate = tipDateKey(tip)
  if (!baseDate) return { id: '', fix: null, resolvedBy: 'missing_date' }

  const dates = [baseDate, shiftDate(baseDate, -1), shiftDate(baseDate, 1)].filter(Boolean)
  const all = []
  for (const dateKey of [...new Set(dates)]) {
    const rows = await fetchFixturesByDate(dateKey)
    for (const fix of rows) {
      const home = fix && fix.teams && fix.teams.home && fix.teams.home.name
      const away = fix && fix.teams && fix.teams.away && fix.teams.away.name
      if (namesClose(home, teams.homeRaw) && namesClose(away, teams.awayRaw)) all.push(fix)
    }
  }
  if (!all.length) return { id: '', fix: null, resolvedBy: 'teams_date_not_found' }

  const targetRaw = tip.match_time || tip.event_time || tip.kickoff_time || ''
  const targetMs = Date.parse(targetRaw)
  all.sort((a, b) => {
    if (!Number.isFinite(targetMs)) return fixtureKickoffMs(b) - fixtureKickoffMs(a)
    return Math.abs(fixtureKickoffMs(a) - targetMs) - Math.abs(fixtureKickoffMs(b) - targetMs)
  })
  const fix = all[0]
  const recoveredId = String(fix && fix.fixture && fix.fixture.id || '').trim()
  if (!recoveredId) return { id: '', fix: null, resolvedBy: 'matched_without_id' }
  fixtureByIdCache.set(recoveredId, Promise.resolve(fix))
  return { id: recoveredId, fix, resolvedBy: 'teams_and_date' }
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
  // Standardowe rynki piłkarskie są rozliczane po 90 minutach, bez dogrywki/karnych.
  const regular = fix && fix.score && fix.score.fulltime ? fix.score.fulltime : {}
  const goals = fix && fix.goals ? fix.goals : {}
  const h = regular.home != null ? regular.home : goals.home
  const a = regular.away != null ? regular.away : goals.away
  return { h: toNum(h, 0), a: toNum(a, 0) }
}

async function settleTip(tip) {
  const resolved = await resolveFixtureForTip(tip)
  const id = resolved.id
  const fix = resolved.fix
  if (!id || !fix) return { status: 'skipped', reason: 'Nie znaleziono fixture_id: ' + resolved.resolvedBy, resolved_by: resolved.resolvedBy }
  const st = String((((fix.fixture || {}).status || {}).short) || '')
  if (VOIDED.includes(st)) return { status: 'void', reason: 'Mecz void status=' + st, resolved_fixture_id: id, resolved_by: resolved.resolvedBy }
  if (!FINISHED.includes(st)) return { status: 'pending', reason: 'Mecz nie jest zakonczony status=' + st, resolved_fixture_id: id, resolved_by: resolved.resolvedBy }
  const sc = scoreFromFixture(fix)
  const keys = fallbackKeys(tip)
  let stats = []
  if (norm(keys.market).includes('corner') || norm(keys.market).includes('card')) stats = await fetchStats(id)
  return { ...settleByKeys(tip, sc.h, sc.a, stats), resolved_fixture_id: id, resolved_by: resolved.resolvedBy }
}

function isAkoTip(tip) {
  return Boolean(
    tip && (
      tip.is_ako === true ||
      String(tip.is_ako || '').toLowerCase() === 'true' ||
      norm(tip.coupon_type) === 'ako' ||
      norm(tip.market) === 'ako' ||
      norm(tip.market_name) === 'ako'
    )
  )
}

function parseAkoLegs(tip) {
  const source = tip && (tip.legs_json || tip.legs || tip.ako_legs || tip.coupon_legs)
  if (Array.isArray(source)) return source
  if (source && typeof source === 'object') return Array.isArray(source) ? source : []
  if (typeof source === 'string' && source.trim()) {
    try {
      const parsed = JSON.parse(source)
      return Array.isArray(parsed) ? parsed : []
    } catch (_) {
      return []
    }
  }
  return []
}

function legFixtureId(leg) {
  const vals = [leg.fixture_id, leg.api_fixture_id, leg.external_fixture_id, leg.fixtureId, leg.matchId, leg.match_id, leg.id]
  for (const v of vals) {
    const st = String(v == null ? '' : v).trim()
    if (st && !st.startsWith('manual-')) return st
  }

  // Stare AKO ma fixture w key, np. "1548435|1x2|norway u21 wygra|1.6".
  const key = String(leg.key || '').trim()
  const first = key.split('|')[0]
  if (/^\d{4,}$/.test(first)) return first
  return ''
}

function normalizeAkoLegForSettlement(leg) {
  const id = legFixtureId(leg)
  return {
    ...leg,
    fixture_id: id || leg.fixture_id || leg.matchId || null,
    api_fixture_id: id || leg.api_fixture_id || null,
    external_fixture_id: id || leg.external_fixture_id || null,
    team_home: leg.team_home || leg.home || leg.home_team || '',
    team_away: leg.team_away || leg.away || leg.away_team || '',
    market: leg.market || leg.market_name || '',
    market_key: leg.market_key || leg.marketKey || '',
    selection_key: leg.selection_key || leg.selectionKey || '',
    bet_type: leg.bet_type || leg.pick || leg.prediction || '',
    prediction: leg.prediction || leg.pick || leg.bet_type || '',
    pick: leg.pick || leg.prediction || leg.bet_type || ''
  }
}

function scoreTextFromFixture(fix) {
  const sc = scoreFromFixture(fix)
  return String(sc.h) + ':' + String(sc.a)
}

async function settleAkoLeg(leg) {
  const normalizedLeg = normalizeAkoLegForSettlement(leg)
  const id = fixtureId(normalizedLeg)
  if (!id) return { ...leg, status: 'pending', result: 'pending', reason: 'AKO: brak fixture_id' }

  const fix = await fetchFixture(id)
  if (!fix) return { ...leg, status: 'pending', result: 'pending', reason: 'AKO: API nie zwrocilo meczu ' + id }

  const st = String((((fix.fixture || {}).status || {}).short) || '')
  const score = scoreTextFromFixture(fix)

  if (VOIDED.includes(st)) {
    return { ...leg, fixture_id: id, api_fixture_id: id, status: 'void', result: 'void', settlement_status: 'void', score, reason: 'AKO noga void status=' + st, settled_at: new Date().toISOString() }
  }

  if (!FINISHED.includes(st)) {
    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT']
    const liveStatus = liveStatuses.includes(st) ? 'live' : 'pending'
    return { ...leg, fixture_id: id, api_fixture_id: id, status: liveStatus, result: liveStatus, settlement_status: liveStatus, score, reason: 'AKO noga nie zakonczona status=' + st }
  }

  const sc = scoreFromFixture(fix)
  const keys = fallbackKeys(normalizedLeg)
  let stats = []
  if (norm(keys.market).includes('corner') || norm(keys.market).includes('card')) stats = await fetchStats(id)

  const res = settleByKeys(normalizedLeg, sc.h, sc.a, stats)
  const finalStatus = ['won','lost','void'].includes(res.status) ? res.status : 'pending'
  return {
    ...leg,
    fixture_id: id,
    api_fixture_id: id,
    status: finalStatus,
    result: finalStatus,
    settlement_status: finalStatus,
    score,
    reason: res.reason || null,
    settled_at: ['won','lost','void'].includes(finalStatus) ? new Date().toISOString() : null
  }
}

async function settleAkoTip(tip) {
  const legs = parseAkoLegs(tip)
  if (!legs.length) return { status: 'skipped', reason: 'AKO: brak legs_json' }

  const settledLegs = []
  for (const leg of legs) {
    settledLegs.push(await settleAkoLeg(leg))
  }

  const statuses = settledLegs.map(leg => String(leg.status || leg.result || 'pending').toLowerCase())
  let status = 'pending'
  let reason = 'AKO: czeka na pozostale nogi'

  if (statuses.includes('lost')) {
    status = 'lost'
    reason = 'AKO przegrane: co najmniej jedna noga nietrafiona'
  } else if (statuses.length && statuses.every(st => ['won', 'void'].includes(st))) {
    status = 'won'
    reason = 'AKO wygrane: wszystkie nogi trafione/zwrot'
  } else if (statuses.every(st => st === 'void')) {
    status = 'void'
    reason = 'AKO zwrot: wszystkie nogi void'
  }

  return {
    status,
    reason,
    legs_json: settledLegs,
    leg_statuses: statuses
  }
}


function profitFromSettlement(tip, status) {
  const stake = toNum(tip && (tip.stake ?? tip.amount ?? tip.bet_amount), 0)
  const odds = toNum(tip && (tip.odds ?? tip.course), 0)
  if (status === 'won') return Math.round((stake * Math.max(odds - 1, 0)) * 100) / 100
  if (status === 'lost') return Math.round((-stake) * 100) / 100
  if (status === 'void') return 0
  return toNum(tip && tip.profit, 0)
}

function updatePayload(result, tip = {}) {
  const status = ['won','lost','void'].includes(result.status) ? result.status : 'pending'
  const stake = toNum(tip && (tip.stake ?? tip.amount ?? tip.bet_amount), 0)
  const odds = toNum(tip && (tip.odds ?? tip.course), 0)

  const profit = status === 'won'
    ? Math.round((stake * Math.max(odds - 1, 0)) * 100) / 100
    : status === 'lost'
      ? Math.round((-stake) * 100) / 100
      : 0

  const payout = status === 'won'
    ? Math.round((stake * odds) * 100) / 100
    : status === 'void'
      ? stake
      : 0

  const payload = {
    status,
    result: status,
    settlement_status: status,
    result_status: status,
    profit,
    payout,
    return_amount: payout,
    settlement_reason: result.reason || null,
    updated_at: new Date().toISOString()
  }

  if (result.resolved_fixture_id) {
    payload.fixture_id = String(result.resolved_fixture_id)
    payload.api_fixture_id = String(result.resolved_fixture_id)
    payload.external_fixture_id = String(result.resolved_fixture_id)
  }
  if (Array.isArray(result.legs_json)) payload.legs_json = result.legs_json
  return payload
}



function missingUpdateColumn(error) {
  const message = String(error?.message || error || '')
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match ? match[1] : ''
}

async function updateTipSafe(supabase, tipId, originalPayload, maxAttempts = 12) {
  const payload = { ...originalPayload }
  const removedColumns = []

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { error } = await supabase.from('tips').update(payload).eq('id', tipId)
    if (!error) return { error: null, removedColumns }

    const missing = missingUpdateColumn(error)
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      delete payload[missing]
      removedColumns.push(missing)
      continue
    }

    return { error, removedColumns }
  }

  return {
    error: new Error(`Nie udało się zapisać rozliczenia po ${maxAttempts} próbach`),
    removedColumns
  }
}

// Rozliczanie wyłącznie wirtualnych typów profilu Typer Expert.
exports.config = { schedule: '37 * * * *' }

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  const supabase = getSupabase()
  const { data: tips, error } = await supabase
    .from('tips')
    .select('*')
    .eq('author_name', AUTHOR_NAME)
    .or('status.eq.pending,settlement_status.eq.pending,status.is.null,settlement_status.is.null')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return json(500, { ok: false, error: error.message })

  const checked = []
  const settled = []
  const skipped = []
  for (const tip of (tips || [])) {
    try {
      const res = isAkoTip(tip) ? await settleAkoTip(tip) : await settleTip(tip)
      checked.push({
        id: tip.id,
        type: isAkoTip(tip) ? 'ako' : 'single',
        fixture_id: res.resolved_fixture_id || fixtureId(tip),
        resolved_by: res.resolved_by || null,
        result: res.status,
        reason: res.reason,
        leg_statuses: res.leg_statuses || null
      })
      if (['won','lost','void'].includes(res.status)) {
        const save = await updateTipSafe(supabase, tip.id, updatePayload(res, tip))
        if (save.error) skipped.push({ id: tip.id, reason: save.error.message, removed_columns: save.removedColumns })
        else settled.push({ id: tip.id, status: res.status, type: isAkoTip(tip) ? 'ako' : 'single', removed_columns: save.removedColumns })
      } else if (!isAkoTip(tip) && res.resolved_fixture_id && !fixtureId(tip)) {
        // Stary rekord zapisany bez fixture_id: odzyskaj ID nawet wtedy,
        // gdy mecz jest jeszcze live/pending. Następne uruchomienie użyje już ID.
        const save = await updateTipSafe(supabase, tip.id, {
          fixture_id: String(res.resolved_fixture_id),
          api_fixture_id: String(res.resolved_fixture_id),
          external_fixture_id: String(res.resolved_fixture_id),
          updated_at: new Date().toISOString()
        })
        if (save.error) skipped.push({ id: tip.id, reason: save.error.message, removed_columns: save.removedColumns })
      } else if (isAkoTip(tip) && Array.isArray(res.legs_json)) {
        // AKO jeszcze nie jest całe rozstrzygnięte, ale zapisujemy statusy pojedynczych nóg
        // np. jedna noga live/pending, druga już won.
        const save = await updateTipSafe(supabase, tip.id, {
          legs_json: res.legs_json,
          settlement_reason: res.reason || null,
          updated_at: new Date().toISOString()
        })
        if (save.error) skipped.push({ id: tip.id, reason: save.error.message, removed_columns: save.removedColumns })
      }
    } catch (e) {
      skipped.push({ id: tip.id, reason: e.message || String(e) })
    }
  }
  return json(200, { ok: true, version: VERSION, author: AUTHOR_NAME, checked: checked.length, settled, skipped, schemaFallbackUsed: settled.some(row => (row.removed_columns || []).length > 0), sample: checked.slice(0, 20) })
}
