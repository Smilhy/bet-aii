const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APISPORTS_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback }
function scoreN(v) { if (v === undefined || v === null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null }
function norm(s) { return String(s || '').toLowerCase().trim() }
function cleanName(s) { return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() }
function includesName(text, name) {
  const a = cleanName(text)
  const b = cleanName(name)
  return Boolean(b && (a.includes(b) || b.includes(a)))
}
function profitFromStatus(status, odds, stake = 100) {
  if (status === 'won') return Math.round((n(odds, 1) - 1) * stake)
  if (status === 'lost') return -stake
  return 0
}

function isBttsTip(tip) {
  const raw = `${tip.market || ''} ${tip.bet_type || ''} ${tip.pick || ''} ${tip.selection || ''} ${tip.prediction || ''}`
  const text = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const compact = text.replace(/[^a-z0-9]+/g, '')
  return (
    compact.includes('btts') ||
    compact.includes('bothteamstoscore') ||
    compact.includes('obiedruzynystrzela') ||
    compact.includes('obiestrzela')
  )
}

const SPORT_RESULT_APIS = [
  { match: ['piłka nożna','pilka nozna','football','soccer'], host: 'https://v3.football.api-sports.io', path: '/fixtures', type: 'football' },
  { match: ['koszykówka','koszykowka','basketball'], host: 'https://v1.basketball.api-sports.io', path: '/games', type: 'games' },
  { match: ['nba'], host: 'https://v2.nba.api-sports.io', path: '/games', type: 'games' },
  { match: ['baseball'], host: 'https://v1.baseball.api-sports.io', path: '/games', type: 'games' },
  { match: ['hokej','hockey'], host: 'https://v1.hockey.api-sports.io', path: '/games', type: 'games' },
  { match: ['siatkówka','siatkowka','volleyball'], host: 'https://v1.volleyball.api-sports.io', path: '/games', type: 'games' },
  { match: ['piłka ręczna','pilka reczna','handball'], host: 'https://v1.handball.api-sports.io', path: '/games', type: 'games' },
  { match: ['nfl','american'], host: 'https://v1.american-football.api-sports.io', path: '/games', type: 'games' },
  { match: ['rugby'], host: 'https://v1.rugby.api-sports.io', path: '/games', type: 'games' },
  { match: ['afl'], host: 'https://v1.afl.api-sports.io', path: '/games', type: 'games' },
  { match: ['mma','ufc'], host: 'https://v1.mma.api-sports.io', path: '/fights', type: 'fight' }
]
function cfgForTip(tip) {
  const text = norm(`${tip.sport || ''} ${tip.league || ''} ${tip.league_name || ''} ${tip.country || ''}`)
  return SPORT_RESULT_APIS.find(c => c.match.some(x => text.includes(x))) || SPORT_RESULT_APIS[0]
}
function tipDateKey(tip) {
  if (tip.match_date) return String(tip.match_date).slice(0, 10)
  const raw = tip.event_time || tip.kickoff_time || tip.match_time || tip.created_at || ''
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return String(raw || '').slice(0, 10)
}
function tipHome(tip) {
  return tip.home_team || tip.team_home || tip.home || String(tip.match_name || tip.match || '').split(' vs ')[0] || ''
}
function tipAway(tip) {
  return tip.away_team || tip.team_away || tip.away || String(tip.match_name || tip.match || '').split(' vs ')[1] || ''
}
function itemTeams(item = {}) {
  const home = item?.teams?.home?.name || item?.teams?.home || item?.home?.name || item?.team?.home?.name || item?.fighters?.first?.name || item?.fighters?.home?.name || ''
  const away = item?.teams?.away?.name || item?.teams?.visitors?.name || item?.teams?.away || item?.away?.name || item?.team?.away?.name || item?.fighters?.second?.name || item?.fighters?.away?.name || ''
  return { home: String(home || ''), away: String(away || '') }
}
function sameMatchByNames(tip, item) {
  const teams = itemTeams(item)
  return includesName(teams.home, tipHome(tip)) && includesName(teams.away, tipAway(tip))
}
async function fetchApiSportsResult(tip) {
  const cfg = cfgForTip(tip)
  const directId = tip.external_fixture_id || tip.ai_external_key || tip.fixture_id
  const headers = { 'x-apisports-key': APISPORTS_KEY }

  async function request(url) {
    const res = await fetch(url, { headers })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = null }
    if (!res.ok) throw new Error(`${cfg.type} result API ${res.status}: ${text.slice(0, 160)}`)
    const errors = data?.errors && typeof data.errors === 'object' ? Object.keys(data.errors).filter(k => data.errors[k]) : []
    if (errors.length) throw new Error(`${cfg.type} result API errors: ${JSON.stringify(data.errors).slice(0, 200)}`)
    return Array.isArray(data?.response) ? data.response : []
  }

  if (directId && /^\d+$/.test(String(directId))) {
    const rows = await request(`${cfg.host}${cfg.path}?id=${encodeURIComponent(directId)}`)
    if (rows[0]) return { cfg, item: rows[0] }
  }

  const date = tipDateKey(tip)
  if (!date) return { cfg, item: null }
  const rows = await request(`${cfg.host}${cfg.path}?date=${encodeURIComponent(date)}`)
  return { cfg, item: rows.find(row => sameMatchByNames(tip, row)) || null }
}
function getStatus(item) {
  const raw = item?.fixture?.status?.short || item?.fixture?.status?.long || item?.game?.status?.short || item?.game?.status?.long || item?.status?.short || item?.status?.long || item?.status || item?.fight?.status || ''
  return String(raw || '').toUpperCase()
}
function isFinishedStatus(status) {
  const s = String(status || '').toUpperCase()
  return ['FT','AET','PEN','AOT','AP','FINISHED','FINISH','FINAL','ENDED','AFTER OVER TIME','AFTER PENALTIES'].some(x => s.includes(x))
}
function isCancelledOrVoidStatus(status) {
  const s = String(status || '').toUpperCase()
  return [
    'CANC', 'CANCELLED', 'CANCELED', 'ABD', 'ABANDONED',
    'PST', 'POSTPONED', 'SUSP', 'SUSPENDED', 'WO', 'WALKOVER'
  ].some(x => s.includes(x))
}
function extractScore(item, cfg) {
  if (cfg.type === 'football') return { home: scoreN(item?.goals?.home ?? item?.score?.fulltime?.home ?? item?.score?.extratime?.home ?? item?.score?.penalty?.home), away: scoreN(item?.goals?.away ?? item?.score?.fulltime?.away ?? item?.score?.extratime?.away ?? item?.score?.penalty?.away) }
  if (cfg.type === 'fight') {
    const f1Win = item?.fighters?.first?.winner ?? item?.fighters?.home?.winner
    const f2Win = item?.fighters?.second?.winner ?? item?.fighters?.away?.winner
    if (f1Win === true) return { home: 1, away: 0 }
    if (f2Win === true) return { home: 0, away: 1 }
    return { home: null, away: null }
  }
  return {
    home: scoreN(item?.scores?.home?.total ?? item?.score?.home ?? item?.teams?.home?.score ?? item?.game?.scores?.home?.total),
    away: scoreN(item?.scores?.away?.total ?? item?.score?.away ?? item?.teams?.away?.score ?? item?.teams?.visitors?.score ?? item?.game?.scores?.away?.total)
  }
}

function settleTextV1763(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim()
}
function settleCompactV1763(value = '') {
  return settleTextV1763(value).replace(/[^a-z0-9]+/g, '')
}
function buildSettlementTextV1763(tip = {}) {
  return [
    tip.market_key,
    tip.selection_key,
    tip.market,
    tip.bet_type,
    tip.pick,
    tip.selection,
    tip.prediction
  ].filter(Boolean).join(' ')
}
function extractLineV1763(...values) {
  const raw = values.map(v => String(v || '')).join(' ')
  const text = settleTextV1763(raw).replace(/,/g, '.')
  const keyLine = text.match(/(?:over|under|powyzej|ponizej|total|gole|goals)[a-z0-9\s_-]*(\d+)[_.](\d+)/i)
  if (keyLine) return Number(`${keyLine[1]}.${keyLine[2]}`)
  const normalLine = text.match(/(\d+(?:\.\d+)?)/)
  return normalLine ? Number(normalLine[1]) : NaN
}
function resultSideV1763(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}
function isSupportedResolvableTipV1763(tip = {}) {
  const raw = buildSettlementTextV1763(tip)
  const compact = settleCompactV1763(raw)
  const text = settleTextV1763(raw)
  return (
    compact.includes('over') ||
    compact.includes('under') ||
    compact.includes('powyzej') ||
    compact.includes('ponizej') ||
    compact.includes('goalsoverunder') ||
    compact.includes('gole') ||
    compact.includes('btts') ||
    compact.includes('bothteamstoscore') ||
    compact.includes('obiedruzynystrzela') ||
    compact.includes('obiestrzela') ||
    compact.includes('doublechance') ||
    compact.includes('podwojnaszansa') ||
    compact.includes('1x') ||
    compact.includes('x2') ||
    /(^|[^a-z0-9])12([^a-z0-9]|$)/i.test(raw) ||
    compact.includes('lubremis') ||
    compact.includes('nieprzegra') ||
    compact.includes('matchwinner') ||
    compact.includes('fulltimeresult') ||
    compact.includes('1x2') ||
    compact.includes('wygra') ||
    text.includes('remis') ||
    compact.includes('drawnobet') ||
    compact.includes('dnb')
  )
}
function resolvePick(tip, homeScore, awayScore) {
  const home = n(homeScore)
  const away = n(awayScore)
  const total = home + away

  const marketKeyText = settleTextV1763(tip.market_key || tip.marketKey || '')
  const selectionKeyText = settleTextV1763(tip.selection_key || tip.selectionKey || '')
  const marketRaw = `${tip.market || ''} ${tip.bet_type || ''}`
  const pickRaw = `${tip.pick || ''} ${tip.selection || ''} ${tip.prediction || ''}`
  const allRaw = `${marketKeyText} ${selectionKeyText} ${marketRaw} ${pickRaw}`
  const allText = settleTextV1763(allRaw)
  const compact = settleCompactV1763(allRaw)
  const marketCompact = settleCompactV1763(`${marketKeyText} ${marketRaw}`)
  const selectionCompact = settleCompactV1763(selectionKeyText)
  const pickCompact = settleCompactV1763(pickRaw)

  const homeName = tipHome(tip)
  const awayName = tipAway(tip)
  const homeCompact = settleCompactV1763(homeName)
  const awayCompact = settleCompactV1763(awayName)
  const result = resultSideV1763(home, away)

  // 1) GOLE: over / under.
  // Obsługuje: over_1_5, under_3_5, Powyżej 1.5 gola, Poniżej 3.5 gola.
  const overUnderText = settleTextV1763(`${selectionKeyText} ${pickRaw}`)
  const overUnderCompact = settleCompactV1763(`${selectionKeyText} ${pickRaw}`)
  const isGoalsMarket =
    marketCompact.includes('goalsoverunder') ||
    marketCompact.includes('goals') ||
    marketCompact.includes('gole') ||
    marketCompact.includes('totalgoals')

  const isOver =
    selectionCompact.startsWith('over') ||
    overUnderCompact.includes('powyzej') ||
    /(^|[^a-z0-9])over([^a-z0-9]|$)/i.test(overUnderText)

  const isUnder =
    selectionCompact.startsWith('under') ||
    overUnderCompact.includes('ponizej') ||
    /(^|[^a-z0-9])under([^a-z0-9]|$)/i.test(overUnderText)

  if (isGoalsMarket || isOver || isUnder) {
    const line = extractLineV1763(selectionKeyText, pickRaw, marketRaw)
    if (Number.isFinite(line) && (isOver || isUnder)) {
      if (total === line) return 'void'
      if (isOver) return total > line ? 'won' : 'lost'
      if (isUnder) return total < line ? 'won' : 'lost'
    }
  }

  // 2) BTTS / Obie drużyny strzelą TAK/NIE.
  const isBtts =
    marketCompact.includes('btts') ||
    compact.includes('btts') ||
    compact.includes('bothteamstoscore') ||
    compact.includes('obiedruzynystrzela') ||
    compact.includes('obiestrzela')

  if (isBtts) {
    const wantsNo =
      ['no', 'nie', 'n'].includes(selectionCompact) ||
      compact.includes('bttsno') ||
      compact.includes('bothteamstoscoreno') ||
      compact.includes('obiedruzynystrzelanie') ||
      compact.includes('obiestrzelanie') ||
      /(^|\s)(no|nie)($|\s)/.test(allText)

    const wantsYes =
      ['yes', 'tak', 'y'].includes(selectionCompact) ||
      compact.includes('bttsyes') ||
      compact.includes('bothteamstoscoreyes') ||
      compact.includes('obiedruzynystrzelatak') ||
      compact.includes('obiestrzelatak') ||
      /(^|\s)(yes|tak)($|\s)/.test(allText)

    const bothScored = home > 0 && away > 0
    if (wantsNo) return !bothScored ? 'won' : 'lost'
    if (wantsYes || isBtts) return bothScored ? 'won' : 'lost'
  }

  // 3) Podwójna szansa: 1X / X2 / 12 oraz "drużyna lub remis".
  const hasExplicit1X = selectionCompact === '1x' || /(^|[^a-z0-9])1x([^a-z0-9]|$)/i.test(allRaw)
  const hasExplicitX2 = selectionCompact === 'x2' || /(^|[^a-z0-9])x2([^a-z0-9]|$)/i.test(allRaw)
  const hasExplicit12 = selectionCompact === '12' || /(^|[^a-z0-9])12([^a-z0-9]|$)/i.test(allRaw)

  const isDoubleChance =
    marketCompact.includes('doublechance') ||
    marketCompact.includes('podwojnaszansa') ||
    compact.includes('podwojnaszansa') ||
    compact.includes('lubremis') ||
    compact.includes('nieprzegra') ||
    hasExplicit1X ||
    hasExplicitX2 ||
    hasExplicit12

  if (isDoubleChance) {
    let dc = ''
    if (hasExplicit1X) dc = '1x'
    else if (hasExplicitX2) dc = 'x2'
    else if (hasExplicit12) dc = '12'
    else if (compact.includes('lubremis') || compact.includes('nieprzegra')) {
      if (homeCompact && pickCompact.includes(homeCompact)) dc = '1x'
      else if (awayCompact && pickCompact.includes(awayCompact)) dc = 'x2'
    } else if (homeCompact && awayCompact && pickCompact.includes(homeCompact) && pickCompact.includes(awayCompact)) {
      dc = '12'
    }

    if (dc === '1x') return (result === 'home' || result === 'draw') ? 'won' : 'lost'
    if (dc === 'x2') return (result === 'away' || result === 'draw') ? 'won' : 'lost'
    if (dc === '12') return result !== 'draw' ? 'won' : 'lost'
  }

  // 4) Draw No Bet.
  const isDnb = marketCompact.includes('drawnobet') || selectionCompact.includes('dnb') || compact.includes('dnb')
  if (isDnb) {
    if (result === 'draw') return 'void'
    const dnbHome = selectionCompact === 'home' || selectionCompact === '1' || (homeCompact && pickCompact.includes(homeCompact))
    const dnbAway = selectionCompact === 'away' || selectionCompact === '2' || (awayCompact && pickCompact.includes(awayCompact))
    if (dnbHome) return result === 'home' ? 'won' : 'lost'
    if (dnbAway) return result === 'away' ? 'won' : 'lost'
  }

  // 5) 1X2 / zwycięzca meczu.
  const isDrawPick =
    selectionCompact === 'draw' ||
    selectionCompact === 'x' ||
    allText === 'remis' ||
    pickCompact === 'remis' ||
    pickCompact === 'draw'

  const isHomePick =
    selectionCompact === 'home' ||
    selectionCompact === '1' ||
    pickCompact.includes('homewin') ||
    (homeCompact && pickCompact.includes(homeCompact) && (pickCompact.includes('wygra') || pickCompact.includes('win')))

  const isAwayPick =
    selectionCompact === 'away' ||
    selectionCompact === '2' ||
    pickCompact.includes('awaywin') ||
    (awayCompact && pickCompact.includes(awayCompact) && (pickCompact.includes('wygra') || pickCompact.includes('win')))

  if (isDrawPick) return result === 'draw' ? 'won' : 'lost'
  if (isHomePick) return result === 'home' ? 'won' : 'lost'
  if (isAwayPick) return result === 'away' ? 'won' : 'lost'

  return 'void'
}

async function updateAiBet(supabase, id, fullUpdate, minimalUpdate) {
  const first = await supabase.from('ai_bets').update(fullUpdate).eq('id', id)
  if (!first.error) return { ok: true, fallback: false }
  const msg = String(first.error.message || '')
  if (!/column|schema|does not exist|Could not find/i.test(msg)) throw first.error

  // 1764: średni fallback próbuje też aktualizować settlement_status,
  // bo frontend/profil często czyta właśnie to pole.
  const mediumUpdate = {
    status: minimalUpdate.status,
    result: minimalUpdate.result,
    settlement_status: minimalUpdate.status,
    settlement_source: fullUpdate.settlement_source || 'auto_ai_result_api',
    profit: minimalUpdate.profit,
    updated_at: new Date().toISOString()
  }
  const mid = await supabase.from('ai_bets').update(mediumUpdate).eq('id', id)
  if (!mid.error) return { ok: true, fallback: true, firstError: msg }

  const second = await supabase.from('ai_bets').update(minimalUpdate).eq('id', id)
  if (second.error) throw second.error
  return { ok: true, fallback: true, firstError: msg, secondError: String(mid.error.message || '') }
}

function normSyncV1764(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compactSyncV1764(value = '') {
  return normSyncV1764(value).replace(/\s+/g, '')
}

function isBetaiMultisportRowV1764(row = {}) {
  const raw = [
    row.username,
    row.author_name,
    row.user_name,
    row.ai_source,
    row.ai_model_version,
    row.source,
    row.tip_source
  ].filter(Boolean).join(' ')
  const compact = compactSyncV1764(raw)
  return compact.includes('betaimultisport') || compact.includes('multisportai')
}

function anyIdValuesV1764(row = {}) {
  return [
    row.ai_external_key,
    row.external_fixture_id,
    row.api_fixture_id,
    row.fixture_id,
    row.match_id,
    row.event_id
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(v => String(v).trim().toLowerCase())
}

function matchNameV1764(row = {}) {
  return normSyncV1764(row.match_name || row.match || `${row.team_home || row.home_team || ''} ${row.team_away || row.away_team || ''}`)
}

function predictionKeyV1764(row = {}) {
  return compactSyncV1764([
    row.market_key,
    row.selection_key,
    row.market,
    row.bet_type,
    row.pick,
    row.selection,
    row.prediction
  ].filter(Boolean).join(' '))
}

function sameBotTipV1764(aiBet = {}, tipRow = {}) {
  if (!isBetaiMultisportRowV1764(aiBet) && !isBetaiMultisportRowV1764(tipRow)) return false

  const aiIds = new Set(anyIdValuesV1764(aiBet))
  const tipIds = anyIdValuesV1764(tipRow)
  const idHit = tipIds.some(id => aiIds.has(id))

  const aiPrediction = predictionKeyV1764(aiBet)
  const tipPrediction = predictionKeyV1764(tipRow)
  const predictionHit =
    aiPrediction &&
    tipPrediction &&
    (
      aiPrediction.includes(tipPrediction) ||
      tipPrediction.includes(aiPrediction) ||
      compactSyncV1764(aiBet.prediction || '') === compactSyncV1764(tipRow.prediction || '')
    )

  if (idHit && (predictionHit || !tipPrediction || !aiPrediction)) return true

  const aiMatch = matchNameV1764(aiBet)
  const tipMatch = matchNameV1764(tipRow)
  const matchHit = aiMatch && tipMatch && (aiMatch.includes(tipMatch) || tipMatch.includes(aiMatch))

  const aiDate = String(aiBet.match_date || aiBet.event_date || aiBet.created_at || '').slice(0, 10)
  const tipDate = String(tipRow.match_date || tipRow.event_date || tipRow.created_at || '').slice(0, 10)
  const dateHit = !aiDate || !tipDate || aiDate === tipDate

  return Boolean(matchHit && dateHit && predictionHit)
}

async function updateTipRowSettlementV1764(supabase, id, finalStatus, finalResult, profit, fullUpdate = {}) {
  const common = {
    status: finalStatus,
    result: finalResult,
    settlement_status: finalStatus,
    settlement_source: fullUpdate.settlement_source || 'auto_ai_result_api_synced_from_ai_bets',
    profit,
    updated_at: new Date().toISOString()
  }

  const first = await supabase.from('tips').update({
    ...common,
    result_status: finalStatus,
    live_score_home: fullUpdate.live_score_home,
    live_score_away: fullUpdate.live_score_away,
    live_status: fullUpdate.live_status,
    settled_at: fullUpdate.settled_at || new Date().toISOString()
  }).eq('id', id)

  if (!first.error) return { ok: true, fallback: false }

  const msg = String(first.error.message || '')
  if (!/column|schema|does not exist|Could not find/i.test(msg)) throw first.error

  const second = await supabase.from('tips').update(common).eq('id', id)
  if (!second.error) return { ok: true, fallback: true, firstError: msg }

  const msg2 = String(second.error.message || '')
  if (!/column|schema|does not exist|Could not find/i.test(msg2)) throw second.error

  const third = await supabase.from('tips').update({
    status: finalStatus,
    result: finalResult,
    profit
  }).eq('id', id)
  if (third.error) throw third.error

  return { ok: true, fallback: true, firstError: msg, secondError: msg2 }
}

async function syncAiBetToTipsV1764(supabase, aiBet, linkedTipRows, finalStatus, finalResult, profit, fullUpdate) {
  const rows = Array.isArray(linkedTipRows) ? linkedTipRows : []
  const matches = rows.filter(row => sameBotTipV1764(aiBet, row))
  let updated = 0
  let fallback = 0

  for (const row of matches) {
    if (!row.id) continue
    const up = await updateTipRowSettlementV1764(supabase, row.id, finalStatus, finalResult, profit, fullUpdate)
    updated++
    if (up.fallback) fallback++
  }

  return { updated, fallback }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !APISPORTS_KEY) return json(500, { error: 'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY albo APISPORTS_KEY.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const { data: rows, error } = await supabase
      .from('ai_bets')
      .select('*')
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })
      .limit(700)
    if (error) throw error

    const query = event.queryStringParameters || {}
    const forceResettle = ['1', 'true', 'yes'].includes(norm(query.force || query.resettle || ''))
    const isSettled = tip => ['won','lost','void','win','loss','push'].includes(norm(tip.status || tip.result || tip.result_status))
    const isPending = tip => ['pending','live',''].includes(norm(tip.status || tip.result || tip.result_status))
    const hasScore = tip => scoreN(tip.live_score_home ?? tip.score_home ?? tip.home_score ?? tip.final_score_home ?? tip.goals_home) !== null && scoreN(tip.live_score_away ?? tip.score_away ?? tip.away_score ?? tip.final_score_away ?? tip.goals_away) !== null
    const hasVerifiedScore = tip => hasScore(tip) && Boolean(tip.live_status || tip.settlement_source === 'auto_ai_result_api')
    const now = Date.now()
    const candidates = (rows || []).filter(tip => {
      const current = norm(tip.status || tip.result_status || tip.result || '')
      const likelyWrongVoidOrSupported = ['void', 'push'].includes(current) && isSupportedResolvableTipV1763(tip)
      if (!(forceResettle || isPending(tip) || !hasVerifiedScore(tip) || likelyWrongVoidOrSupported)) return false
      const d = new Date(`${tip.match_date || tipDateKey(tip)}T${String(tip.match_time || '23:59').slice(0,5)}:00`)
      return forceResettle || Number.isNaN(d.getTime()) || d.getTime() < now + 3 * 60 * 60 * 1000
    })

    const { data: linkedTipRowsRaw } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000)

    const linkedTipRows = Array.isArray(linkedTipRowsRaw)
      ? linkedTipRowsRaw.filter(isBetaiMultisportRowV1764)
      : []

    let settled = 0, checked = 0, skipped = 0, backfilled = 0, fallbackUpdates = 0, syncedTips = 0, syncedTipsFallback = 0
    const errors = []
    for (const tip of candidates) {
      checked++
      try {
        const currentStatusBeforeFetch = norm(tip.status || tip.result_status || tip.result || '')
        const wasVoidLikeBeforeFetch = ['void', 'push'].includes(currentStatusBeforeFetch)
        const bttsTipBeforeFetch = isBttsTip(tip)
        const supportedTipBeforeFetch = isSupportedResolvableTipV1763(tip)

        async function resetWrongSupportedVoidToPending(reason) {
          const fullUpdate = {
            status: 'pending',
            result: 'pending',
            result_status: 'pending',
            settlement_status: 'pending',
            profit: 0,
            settlement_source: `1763-supported-market-void-reset-to-pending-${reason}`,
            updated_at: new Date().toISOString()
          }
          const minimalUpdate = { status: 'pending', result: 'pending', profit: 0 }
          const up = await updateAiBet(supabase, tip.id, fullUpdate, minimalUpdate)
          if (up.fallback) fallbackUpdates++
          const sync = await syncAiBetToTipsV1764(supabase, tip, linkedTipRows, 'pending', 'pending', 0, fullUpdate)
          syncedTips += sync.updated
          syncedTipsFallback += sync.fallback
          backfilled++
        }

        const { cfg, item } = await fetchApiSportsResult(tip)
        if (!item) {
          // FIX 1750:
          // Jeśli stary BTTS ma VOID, ale nie mamy wyniku/API nie znalazło meczu,
          // nie wolno udawać rozliczenia jako VOID. Cofamy na PENDING.
          if (wasVoidLikeBeforeFetch && supportedTipBeforeFetch && !hasScore(tip)) {
            await resetWrongSupportedVoidToPending('no-result-item')
          } else {
            skipped++
          }
          continue
        }
        const statusRaw = getStatus(item, cfg)
        if (!isFinishedStatus(statusRaw)) {
          if (isCancelledOrVoidStatus(statusRaw)) {
            // Prawdziwy VOID zostaje tylko dla odwołanych/przełożonych/abandoned.
            const fullUpdate = {
              live_status: statusRaw || 'VOID',
              result_status: 'void',
              settlement_source: 'auto_ai_result_api_cancelled',
              updated_at: new Date().toISOString(),
              status: 'void',
              result: 'void',
              profit: 0,
              settled_at: new Date().toISOString()
            }
            const minimalUpdate = { status: 'void', result: 'void', profit: 0 }
            const up = await updateAiBet(supabase, tip.id, fullUpdate, minimalUpdate)
            if (up.fallback) fallbackUpdates++
            const sync = await syncAiBetToTipsV1764(supabase, tip, linkedTipRows, 'void', 'void', 0, fullUpdate)
            syncedTips += sync.updated
            syncedTipsFallback += sync.fallback
            settled++
          } else if (wasVoidLikeBeforeFetch && supportedTipBeforeFetch && !hasScore(tip)) {
            await resetWrongSupportedVoidToPending('not-finished-yet')
          } else {
            skipped++
          }
          continue
        }
        const score = extractScore(item, cfg)
        if (score.home == null || score.away == null) {
          if (wasVoidLikeBeforeFetch && supportedTipBeforeFetch && !hasScore(tip)) {
            await resetWrongSupportedVoidToPending('finished-without-score')
          } else {
            skipped++
          }
          continue
        }

        const computedStatus = resolvePick(tip, score.home, score.away)
        const currentStatus = norm(tip.status || tip.result_status || tip.result || '')
        const wasVoidLike = ['void', 'push'].includes(currentStatus)

        // FIX 1749:
        // Poprzednia wersja tylko backfillowała wynik dla już oznaczonych VOID,
        // ale nie zmieniała błędnego VOID na WON/LOST. Dlatego BTTS w Typy AI
        // zostawał jako VOID mimo finalnego wyniku. Teraz przeliczamy VOID/PUSH,
        // jeśli mecz ma finalny wynik i resolvePick daje WON albo LOST.
        const shouldResettleWrongVoid =
          wasVoidLike &&
          ['won', 'lost'].includes(computedStatus) &&
          isSupportedResolvableTipV1763(tip)

        const shouldForceResettleSupported =
          forceResettle &&
          isSupportedResolvableTipV1763(tip) &&
          ['won', 'lost', 'void'].includes(computedStatus)

        const shouldResolveStatus = shouldForceResettleSupported || isPending(tip) || !isSettled(tip) || shouldResettleWrongVoid
        const finalStatus = shouldResolveStatus ? computedStatus : currentStatus || computedStatus
        const finalResult = finalStatus === 'won' ? 'win' : finalStatus === 'lost' ? 'loss' : 'void'
        const profit = profitFromStatus(finalStatus, tip.odds, n(tip.stake, 100) || 100)
        const fullUpdate = {
          live_score_home: scoreN(score.home),
          live_score_away: scoreN(score.away),
          live_status: statusRaw || 'FT',
          result_status: finalStatus,
          settlement_source: 'auto_ai_result_api',
          updated_at: new Date().toISOString(),
          status: finalStatus,
          result: finalResult,
          profit,
          settled_at: new Date().toISOString()
        }
        const minimalUpdate = { status: finalStatus, result: finalResult, profit }

        const up = await updateAiBet(supabase, tip.id, fullUpdate, minimalUpdate)
        if (up.fallback) fallbackUpdates++

        if (shouldResolveStatus) {
          const sync = await syncAiBetToTipsV1764(supabase, tip, linkedTipRows, finalStatus, finalResult, profit, fullUpdate)
          syncedTips += sync.updated
          syncedTipsFallback += sync.fallback
          settled++
        } else {
          backfilled++
        }
      } catch (e) {
        errors.push({ id: tip.id, match: `${tipHome(tip)} vs ${tipAway(tip)}`, date: tip.match_date, error: e.message || String(e) })
      }
    }
    // FIX 1765:
    // Profil/historia bota w UI potrafi czytać bezpośrednio z tabeli tips.
    // Wersja 1764 synchronizowała tips tylko, gdy znalazła parę ai_bets -> tips.
    // U Ciebie syncedTips=0, więc stare "Zwrot" siedziały bezpośrednio w tips.
    // Teraz rozliczamy też samodzielnie wszystkie widoczne rekordy bota z tips.
    let directTipsChecked = 0
    let directTipsSettled = 0
    let directTipsSkipped = 0
    let directTipsFallback = 0

    const { data: directBotTipsRaw } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000)

    const directBotTips = Array.isArray(directBotTipsRaw)
      ? directBotTipsRaw.filter(isBetaiMultisportRowV1764)
      : []

    for (const botTip of directBotTips) {
      directTipsChecked++
      try {
        if (!forceResettle && isSettled(botTip)) {
          directTipsSkipped++
          continue
        }

        if (!isSupportedResolvableTipV1763(botTip)) {
          directTipsSkipped++
          continue
        }

        const { cfg, item } = await fetchApiSportsResult(botTip)
        if (!item) {
          directTipsSkipped++
          continue
        }

        const statusRaw = getStatus(item, cfg)
        if (!isFinishedStatus(statusRaw)) {
          if (isCancelledOrVoidStatus(statusRaw)) {
            const fullUpdate = {
              live_status: statusRaw || 'VOID',
              result_status: 'void',
              settlement_source: 'tips_direct_api_cancelled_v1765',
              updated_at: new Date().toISOString(),
              status: 'void',
              result: 'void',
              profit: 0,
              settled_at: new Date().toISOString()
            }
            const up = await updateTipRowSettlementV1764(supabase, botTip.id, 'void', 'void', 0, fullUpdate)
            if (up.fallback) directTipsFallback++
            directTipsSettled++
          } else {
            directTipsSkipped++
          }
          continue
        }

        const score = extractScore(item, cfg)
        if (score.home == null || score.away == null) {
          directTipsSkipped++
          continue
        }

        const computedStatus = resolvePick(botTip, score.home, score.away)
        if (!['won', 'lost', 'void'].includes(computedStatus)) {
          directTipsSkipped++
          continue
        }

        const finalResult = computedStatus === 'won' ? 'win' : computedStatus === 'lost' ? 'loss' : 'void'
        const profit = profitFromStatus(computedStatus, botTip.odds, n(botTip.stake, 100) || 100)
        const fullUpdate = {
          live_score_home: scoreN(score.home),
          live_score_away: scoreN(score.away),
          live_status: statusRaw || 'FT',
          result_status: computedStatus,
          settlement_source: 'tips_direct_api_v1765',
          updated_at: new Date().toISOString(),
          status: computedStatus,
          result: finalResult,
          profit,
          settled_at: new Date().toISOString()
        }

        const up = await updateTipRowSettlementV1764(supabase, botTip.id, computedStatus, finalResult, profit, fullUpdate)
        if (up.fallback) directTipsFallback++
        directTipsSettled++
      } catch (e) {
        errors.push({ table: 'tips', id: botTip.id, match: `${tipHome(botTip)} vs ${tipAway(botTip)}`, date: botTip.match_date, error: e.message || String(e) })
      }
    }

    try {
      await supabase
        .from('ai_pick_runs')
        .insert({
          source: 'settle-ai-bets-v1765-direct-tips-bot-settle',
          picks_created: settled + directTipsSettled,
          status: errors.length ? 'partial' : 'success',
          finished_at: new Date().toISOString(),
          message: `checked=${checked}; settled=${settled}; backfilled=${backfilled}; skipped=${skipped}; fallbackUpdates=${fallbackUpdates}; syncedTips=${syncedTips}; syncedTipsFallback=${syncedTipsFallback}; directTipsChecked=${directTipsChecked}; directTipsSettled=${directTipsSettled}; directTipsSkipped=${directTipsSkipped}; directTipsFallback=${directTipsFallback}; errors=${errors.length}`
        })
    } catch (_) {
      // Log run jest pomocniczy. Nie może wysadzać settlementu ani mulić strony.
    }
    return json(200, { version: '1765-settle-live-ai-picks-direct-tips-bot-settle', table: 'ai_bets+tips_direct', checked, settled, backfilled, skipped, fallbackUpdates, syncedTips, syncedTipsFallback, directTipsChecked, directTipsSettled, directTipsSkipped, directTipsFallback, errors: errors.slice(0, 20) })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Settle error' })
  }
}
