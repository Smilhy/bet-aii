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

function pickTextOf(tip) {
  return norm([
    tip.bet_type,
    tip.prediction,
    tip.selection,
    tip.pick,
    tip.value,
    tip.tip
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

// WERSJA 5 — globalna identyfikacja DNB.
// Tekst rynku ma pierwszeństwo przed błędnym/starym market_key, ponieważ starsze
// rekordy mogły zapisać DNB jako match_winner i przy remisie oznaczyć typ jako WON.
function looksLikeDnbTip(tip) {
  const raw = norm([
    tip && tip.market_key,
    tip && tip.market,
    tip && tip.market_name,
    tip && tip.bet_type,
    tip && tip.prediction,
    tip && tip.selection,
    tip && tip.pick,
    tip && tip.tip
  ].filter(Boolean).join(' '))
  const c = compact(raw)
  return raw === 'draw_no_bet'
    || c.includes('drawnobet')
    || c.includes('dnb')
    || c.includes('remisniemazakladu')
    || c.includes('bezremisu')
}

function dnbSelectionFromTip(tip) {
  const teams = teamNamesFromTip(tip || {})
  const pickC = compact(pickTextOf(tip || {}))
  const homeC = compact(teams.home)
  const awayC = compact(teams.away)

  // Najpierw ufamy faktycznej nazwie wybranej drużyny zapisanej w typie.
  // Dopiero później używamy starego selection_key, który mógł pochodzić
  // z błędnej klasyfikacji rynku jako match_winner.
  if (awayC && pickC.includes(awayC)) return 'away'
  if (homeC && pickC.includes(homeC)) return 'home'
  if (pickC.includes('away') || pickC === '2dnb' || pickC.endsWith('2dnb')) return 'away'
  if (pickC.includes('home') || pickC === '1dnb' || pickC.endsWith('1dnb')) return 'home'

  const explicit = norm(tip && (tip.selection_key || tip.selectionKey))
  if (explicit === 'home' || explicit === '1') return 'home'
  if (explicit === 'away' || explicit === '2') return 'away'
  return ''
}

function inferPolishSettlementKeysV1723(tip) {
  const t = textOf(tip)
  const c = compact(t)
  const pickText = pickTextOf(tip)
  const pickC = compact(pickText)
  const teams = teamNamesFromTip(tip)
  const home = teams.home
  const away = teams.away
  const homeC = compact(home)
  const awayC = compact(away)

  // Rynki połowowe muszą być rozpoznane przed zwykłym 1X2 i pełnym over/under.
  const isFirstHalfText =
    c.includes('doprzerwy') ||
    c.includes('pierwszejpolowie') ||
    c.includes('1polowie') ||
    c.includes('firsthalf') ||
    c.includes('1sthalf') ||
    c.includes('halftimeresult') ||
    c.includes('halftimeresult')

  if (isFirstHalfText && (pickC.includes('powyzej') || pickC.includes('over'))) {
    return { market: 'first_half_goals_total', selection: 'over_' + onlyLine(pickText || t) }
  }
  if (isFirstHalfText && (pickC.includes('ponizej') || pickC.includes('under'))) {
    return { market: 'first_half_goals_total', selection: 'under_' + onlyLine(pickText || t) }
  }

  if (
    c.includes('jednazpolow') ||
    c.includes('conajmniejjednapolowe') ||
    c.includes('wineitherhalf') ||
    c.includes('towineitherhalf')
  ) {
    if (awayC && pickC.includes(awayC)) return { market: 'team_win_either_half', selection: 'away' }
    if (homeC && pickC.includes(homeC)) return { market: 'team_win_either_half', selection: 'home' }
    if (pickC === 'away' || pickC === '2' || pickC.includes('away')) return { market: 'team_win_either_half', selection: 'away' }
    if (pickC === 'home' || pickC === '1' || pickC.includes('home')) return { market: 'team_win_either_half', selection: 'home' }
  }

  if (
    c.includes('doprzerwy') ||
    c.includes('firsthalfwinner') ||
    c.includes('halftimeresult') ||
    c.includes('halftimeresult')
  ) {
    if (pickC.includes('remis') || pickC.includes('draw') || pickC === 'x') return { market: 'half_time_result', selection: 'draw' }
    if (awayC && pickC.includes(awayC)) return { market: 'half_time_result', selection: 'away' }
    if (homeC && pickC.includes(homeC)) return { market: 'half_time_result', selection: 'home' }
    if (pickC === 'away' || pickC === '2' || pickC.includes('away')) return { market: 'half_time_result', selection: 'away' }
    if (pickC === 'home' || pickC === '1' || pickC.includes('home')) return { market: 'half_time_result', selection: 'home' }
  }

  // "Serbia U19 lub remis" => 1X, "Moldova lub remis" => X2
  if (c.includes('lubremis') || c.includes('nieremis') || c.includes('podwojnaszansa')) {
    if (homeC && pickC.includes(homeC)) return { market: 'double_chance', selection: '1x' }
    if (awayC && pickC.includes(awayC)) return { market: 'double_chance', selection: 'x2' }
    if (pickC === '1x' || pickC.includes('1x')) return { market: 'double_chance', selection: '1x' }
    if (pickC === 'x2' || pickC.includes('x2')) return { market: 'double_chance', selection: 'x2' }
    if (pickC === '12' || pickC.includes('12')) return { market: 'double_chance', selection: '12' }
  }

  // Team Total Goals: gole wybranej drużyny over/under.
  if (c.includes('teamtotal') || c.includes('goledruzyny') || c.includes('sumagolidruzyny') || c.includes('bramkidruzyny')) {
    const side = awayC && pickC.includes(awayC) ? 'away' : 'home'
    if (pickC.includes('powyzej') || pickC.includes('over')) return { market: 'team_total_goals', selection: side + '_over_' + onlyLine(pickText || t) }
    if (pickC.includes('ponizej') || pickC.includes('under')) return { market: 'team_total_goals', selection: side + '_under_' + onlyLine(pickText || t) }
  }
  if ((homeC && pickC.includes(homeC)) || (awayC && pickC.includes(awayC))) {
    const side = awayC && pickC.includes(awayC) ? 'away' : 'home'
    if ((pickC.includes('powyzej') || pickC.includes('over')) && (pickC.includes('gola') || pickC.includes('goal'))) return { market: 'team_total_goals', selection: side + '_over_' + onlyLine(pickText || t) }
    if ((pickC.includes('ponizej') || pickC.includes('under')) && (pickC.includes('gola') || pickC.includes('goal'))) return { market: 'team_total_goals', selection: side + '_under_' + onlyLine(pickText || t) }
  }

  // "Powyżej 2.5 gola" / "Ponizej 3.5 gola"
  if (pickC.includes('powyzej') || pickC.includes('over')) {
    return { market: 'goals_over_under', selection: 'over_' + onlyLine(pickText || t) }
  }
  if (pickC.includes('ponizej') || pickC.includes('under')) {
    return { market: 'goals_over_under', selection: 'under_' + onlyLine(pickText || t) }
  }

  // "Obie drużyny strzelą: TAK/NIE"
  if (c.includes('obiedruzynystrzela') || c.includes('btts')) {
    return { market: 'btts', selection: (pickC.includes('nie') || pickC.includes('no')) ? 'no' : 'yes' }
  }

  // "Drużyna wygra"
  if (pickC.includes('wygra') || pickC.includes('win')) {
    if (awayC && pickC.includes(awayC)) return { market: 'match_winner', selection: 'away' }
    if (homeC && pickC.includes(homeC)) return { market: 'match_winner', selection: 'home' }
  }

  // Same pick as just team name.
  if (homeC && pickC === homeC) return { market: 'match_winner', selection: 'home' }
  if (awayC && pickC === awayC) return { market: 'match_winner', selection: 'away' }

  return { market: '', selection: '' }
}

function fallbackKeys(tip) {
  const t = textOf(tip)
  const c = compact(t)
  let market = norm(tip.market_key || tip.marketKey)
  let selection = norm(tip.selection_key || tip.selectionKey)

  // WERSJA 5: naprawa starych rekordów DNB. Nawet gdy zapisano
  // market_key=match_winner, opis "DNB / remis nie ma zakładu" wymusza
  // prawidłowy rynek draw_no_bet. Przy remisie wynik musi być VOID/ZWROT.
  if (looksLikeDnbTip(tip)) {
    const dnbSelection = dnbSelectionFromTip(tip)
    if (dnbSelection) return { market: 'draw_no_bet', selection: dnbSelection }
    return { market: 'draw_no_bet', selection }
  }

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

function settleByKeys(tip, homeGoals, awayGoals, fixtureStats, periodScores = {}) {
  const keys = fallbackKeys(tip)
  const market = norm(keys.market)
  const selection = norm(keys.selection)
  const result = resultOf(homeGoals, awayGoals)
  const total = homeGoals + awayGoals
  const halfHome = periodScores.halfHome
  const halfAway = periodScores.halfAway
  const secondHome = periodScores.secondHome
  const secondAway = periodScores.secondAway

  if (market === 'half_time_result') {
    if (halfHome == null || halfAway == null) return { status: 'pending_admin_review', reason: 'Wynik do przerwy: API nie zwrocilo wyniku 1. polowy' }
    if (!['home','draw','away'].includes(selection)) return { status: 'pending_admin_review', reason: 'Wynik do przerwy: zly selection_key=' + selection }
    const halfResult = resultOf(halfHome, halfAway)
    return { status: selection === halfResult ? 'won' : 'lost', reason: 'HT 1X2 ' + selection + ' wynik=' + halfResult + ' (' + halfHome + ':' + halfAway + ')' }
  }
  if (market === 'first_half_goals_total') {
    if (halfHome == null || halfAway == null) return { status: 'pending_admin_review', reason: 'Gole 1. polowa: API nie zwrocilo wyniku do przerwy' }
    return overUnder(selection, halfHome + halfAway, 'Gole 1. polowa')
  }
  if (market === 'team_win_either_half') {
    if (!['home','away'].includes(selection)) return { status: 'pending_admin_review', reason: 'Wygra jedna z polow: zly selection_key=' + selection }
    if (halfHome == null || halfAway == null || secondHome == null || secondAway == null) {
      return { status: 'pending_admin_review', reason: 'Wygra jedna z polow: brak pelnych wynikow polow w API' }
    }
    const chosenWon = selection === 'home'
      ? (halfHome > halfAway || secondHome > secondAway)
      : (halfAway > halfHome || secondAway > secondHome)
    return {
      status: chosenWon ? 'won' : 'lost',
      reason: 'Wygra jedna z polow ' + selection + ', 1H=' + halfHome + ':' + halfAway + ', 2H=' + secondHome + ':' + secondAway
    }
  }

  if (market === 'match_winner') {
    if (!['home','draw','away'].includes(selection)) return { status: 'pending_admin_review', reason: '1X2: zly selection_key=' + selection }
    return { status: selection === result ? 'won' : 'lost', reason: '1X2 ' + selection + ' wynik=' + result }
  }
  if (market === 'double_chance') {
    const won = (selection === '1x' && (result === 'home' || result === 'draw')) || (selection === 'x2' && (result === 'away' || result === 'draw')) || (selection === '12' && result !== 'draw')
    if (!['1x','x2','12'].includes(selection)) return { status: 'pending_admin_review', reason: 'Podwojna szansa: zly selection_key=' + selection }
    return { status: won ? 'won' : 'lost', reason: 'DC ' + selection + ' wynik=' + result }
  }
  if (market === 'team_total_goals') {
    const side = selection.startsWith('away') ? 'away' : 'home'
    const direction = selection.includes('_under_') ? 'under' : 'over'
    const lineMatch = String(selection || '').match(/(?:home|away)_(?:over|under)_([0-9]+(?:[._][0-9]+)?)/)
    const line = lineMatch ? lineMatch[1].replace('_', '.') : ''
    const normalizedSelection = direction + '_' + String(line || '').replace('.', '_')
    const teamGoals = side === 'away' ? awayGoals : homeGoals
    return overUnder(normalizedSelection, teamGoals, side === 'away' ? 'Gole gości' : 'Gole gospodarzy')
  }
    if (['goals_over_under', 'goals_total', 'goals_2_5', 'total_goals', 'over_under_goals'].includes(market)) return overUnder(selection, total, 'Gole')
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

function periodScoresFromFixture(fix) {
  const half = fix && fix.score && fix.score.halftime ? fix.score.halftime : {}
  const full = fix && fix.score && fix.score.fulltime ? fix.score.fulltime : {}
  const goals = fix && fix.goals ? fix.goals : {}

  const halfHome = half.home == null ? null : toNum(half.home, 0)
  const halfAway = half.away == null ? null : toNum(half.away, 0)
  const fullHomeRaw = full.home != null ? full.home : goals.home
  const fullAwayRaw = full.away != null ? full.away : goals.away
  const fullHome = fullHomeRaw == null ? null : toNum(fullHomeRaw, 0)
  const fullAway = fullAwayRaw == null ? null : toNum(fullAwayRaw, 0)
  const secondHome = halfHome == null || fullHome == null ? null : Math.max(0, fullHome - halfHome)
  const secondAway = halfAway == null || fullAway == null ? null : Math.max(0, fullAway - halfAway)

  return { halfHome, halfAway, fullHome, fullAway, secondHome, secondAway }
}

function scoreFromFixture(fix) {
  // WERSJA 6 — wszystkie standardowe rynki piłkarskie rozliczamy po 90 minutach.
  // W API-Football `goals` może zawierać wynik po dogrywce albo karnych, natomiast
  // `score.fulltime` przechowuje wynik po regulaminowym czasie gry. DNB, 1X2,
  // BTTS, gole, handicap i dokładny wynik nie mogą uwzględniać dogrywki, chyba że
  // rynek wyraźnie ją obejmuje (takich rynków ten automat obecnie nie publikuje).
  const regular = fix && fix.score && fix.score.fulltime ? fix.score.fulltime : {}
  const goals = fix && fix.goals ? fix.goals : {}
  const h = regular.home != null ? regular.home : goals.home
  const a = regular.away != null ? regular.away : goals.away
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
  const periods = periodScoresFromFixture(fix)
  const keys = fallbackKeys(tip)
  let stats = []
  if (norm(keys.market).includes('corner') || norm(keys.market).includes('card')) stats = await fetchStats(id)
  return settleByKeys(tip, sc.h, sc.a, stats, periods)
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
  const periods = periodScoresFromFixture(fix)
  const keys = fallbackKeys(normalizedLeg)
  let stats = []
  if (norm(keys.market).includes('corner') || norm(keys.market).includes('card')) stats = await fetchStats(id)

  const res = settleByKeys(normalizedLeg, sc.h, sc.a, stats, periods)
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
  } else if (statuses.length && statuses.every(st => st === 'void')) {
    // WERSJA 5: wszystkie nogi zwrócone oznaczają zwrot całego kuponu,
    // a nie wygraną po pierwotnym kursie AKO.
    status = 'void'
    reason = 'AKO zwrot: wszystkie nogi void'
  } else if (statuses.length && statuses.every(st => ['won', 'void'].includes(st))) {
    status = 'won'
    reason = 'AKO wygrane: wszystkie aktywne nogi trafione, nogi void usunięte z kursu'
  }

  const effectiveOdds = settledLegs
    .filter(leg => String(leg.status || leg.result || '').toLowerCase() === 'won')
    .reduce((product, leg) => product * Math.max(toNum(leg.odds ?? leg.course, 1), 1), 1)

  return {
    status,
    reason,
    legs_json: settledLegs,
    leg_statuses: statuses,
    effective_odds: status === 'won' ? effectiveOdds : null
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

function missingColumnName(error) {
  const message = String(error && (error.message || error.details || error.hint) || '')
  const patterns = [
    /Could not find the ['"]([^'"]+)['"] column/i,
    /column ['"]?([a-z0-9_]+)['"]? of relation ['"]?tips['"]? does not exist/i,
    /column (?:public\.)?tips\.([a-z0-9_]+) does not exist/i,
    /column ['"]?([a-z0-9_]+)['"]? does not exist/i
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) return match[1]
  }
  return ''
}

async function updateTipWithSchemaFallback(supabase, tipId, payload) {
  let safePayload = { ...payload }
  const removedColumns = []

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { error } = await supabase.from('tips').update(safePayload).eq('id', tipId)
    if (!error) return { error: null, removedColumns }

    const missing = missingColumnName(error)
    if (!missing || !(missing in safePayload)) return { error, removedColumns }

    delete safePayload[missing]
    removedColumns.push(missing)
  }

  return {
    error: new Error('Nie udało się zaktualizować tips po usunięciu brakujących kolumn'),
    removedColumns
  }
}

function updatePayload(result, tip = {}) {
  const status = ['won','lost','void'].includes(result.status) ? result.status : 'pending'
  const stake = toNum(tip && (tip.stake ?? tip.amount ?? tip.bet_amount), 0)
  const odds = toNum(result && result.effective_odds, toNum(tip && (tip.odds ?? tip.course), 0))

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
    settlement_note: result.reason || null,
    settled_at: ['won','lost','void'].includes(status) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }

  if (Array.isArray(result.legs_json)) payload.legs_json = result.legs_json
  if (result.settlement_source) payload.settlement_source = result.settlement_source
  return payload
}



exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  const supabase = getSupabase()
  const query = event.queryStringParameters || {}
  const requestedLimit = Math.max(1, Math.min(500, Number(query.limit || 120) || 120))
  const repairDnbRaw = query.repair_dnb ?? query.repairDnb
  // Domyślnie włączone: dzięki temu stary błędnie rozliczony DNB naprawi się także
  // po ręcznym lub zaplanowanym wywołaniu funkcji bez dodatkowego parametru.
  const repairDnb = repairDnbRaw == null
    ? true
    : ['1', 'true', 'yes'].includes(norm(repairDnbRaw))

  const pendingRequest = supabase
    .from('tips')
    .select('*')
    .or('status.eq.pending,settlement_status.eq.pending,status.is.null,settlement_status.is.null')
    .order('created_at', { ascending: true })
    .limit(requestedLimit)

  // WERSJA 6 — jednorazowe samonaprawianie starszych DNB.
  // Nie filtrujemy po market/bet_type po stronie PostgREST, bo część starszych
  // rekordów ma DNB tylko w prediction/selection albo błędny market_key.
  // Pobieramy ostatnie rozliczone rekordy i rozpoznajemy DNB bezpiecznie w JS.
  const repairRequest = repairDnb
    ? supabase
      .from('tips')
      .select('*')
      .or('status.eq.won,status.eq.win,status.eq.lost,status.eq.loss,status.eq.void,status.eq.push')
      .order('created_at', { ascending: false })
      .limit(1000)
    : Promise.resolve({ data: [], error: null })

  const [pendingResult, repairResult] = await Promise.all([pendingRequest, repairRequest])
  if (pendingResult.error) return json(500, { ok: false, error: pendingResult.error.message })
  if (repairResult.error) return json(500, { ok: false, error: repairResult.error.message })

  const pendingTips = Array.isArray(pendingResult.data) ? pendingResult.data : []
  const dnbRepairTips = (Array.isArray(repairResult.data) ? repairResult.data : []).filter(tip => {
    if (!looksLikeDnbTip(tip)) return false
    const status = norm(tip.status || tip.result || tip.settlement_status || tip.result_status)
    if (!['won', 'win', 'lost', 'loss', 'void', 'push'].includes(status)) return false
    return !norm(tip.settlement_source).includes('dnb_regular_time_fix_v6')
  })

  const unique = new Map()
  ;[...pendingTips, ...dnbRepairTips].forEach(tip => unique.set(String(tip.id), tip))
  const tips = Array.from(unique.values())
  const repairIds = new Set(dnbRepairTips.map(tip => String(tip.id)))

  const checked = []
  const settled = []
  const skipped = []
  for (const tip of (tips || [])) {
    try {
      const res = isAkoTip(tip) ? await settleAkoTip(tip) : await settleTip(tip)
      checked.push({
        id: tip.id,
        type: isAkoTip(tip) ? 'ako' : 'single',
        fixture_id: fixtureId(tip),
        result: res.status,
        reason: res.reason,
        leg_statuses: res.leg_statuses || null
      })
      if (['won','lost','void'].includes(res.status)) {
        if (looksLikeDnbTip(tip)) {
          res.settlement_source = repairIds.has(String(tip.id))
            ? 'auto_dnb_regular_time_fix_v6_repaired'
            : 'auto_dnb_regular_time_fix_v6'
        }
        const updateResult = await updateTipWithSchemaFallback(supabase, tip.id, updatePayload(res, tip))
        if (updateResult.error) skipped.push({ id: tip.id, reason: updateResult.error.message, removed_columns: updateResult.removedColumns })
        else settled.push({
          id: tip.id,
          status: res.status,
          type: isAkoTip(tip) ? 'ako' : 'single',
          schema_fallback_removed: updateResult.removedColumns
        })
      } else if (isAkoTip(tip) && Array.isArray(res.legs_json)) {
        // AKO jeszcze nie jest całe rozstrzygnięte, ale zapisujemy statusy pojedynczych nóg
        // np. jedna noga live/pending, druga już won.
        const updateResult = await updateTipWithSchemaFallback(supabase, tip.id, {
          legs_json: res.legs_json,
          settlement_reason: res.reason || null,
          settlement_note: res.reason || null,
          updated_at: new Date().toISOString()
        })
        if (updateResult.error) skipped.push({ id: tip.id, reason: updateResult.error.message, removed_columns: updateResult.removedColumns })
      }
    } catch (e) {
      skipped.push({ id: tip.id, reason: e.message || String(e) })
    }
  }
  return json(200, {
    ok: true,
    version: '6-dnb-regular-time-90min-fix',
    checked: checked.length,
    pending_checked: pendingTips.length,
    dnb_repair_candidates: dnbRepairTips.length,
    settled,
    skipped,
    sample: checked.slice(0, 20)
  })
}


// Eksport wyłącznie do lokalnych testów regresji; Netlify używa exports.handler.
exports.__test = { scoreFromFixture, settleByKeys, fallbackKeys, looksLikeDnbTip, dnbSelectionFromTip, updatePayload, missingColumnName, updateTipWithSchemaFallback }
