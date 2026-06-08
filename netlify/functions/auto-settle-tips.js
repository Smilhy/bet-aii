
const { createClient } = require('@supabase/supabase-js')

const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN'])
const VOID_STATUS = new Set(['CANC', 'ABD', 'AWD', 'WO', 'PST'])
const LIVE_STATUS = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT'])
const PENDING_VALUES = new Set(['pending', 'open', 'active', 'oczekujacy', 'oczekujący', 'waiting', 'live'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function apiFootballKey() {
  return process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || process.env.APISPORTS_KEY || process.env.APIFOOTBALL_KEY || process.env.API_SPORTS_KEY || process.env.API_SPORTS_KEY || ''
}

function n(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function cleanStatus(value) {
  return normalize(value).replace(/[^a-z0-9ąćęłńóśźż]+/g, '')
}

function isPendingTip(tip = {}) {
  const statusValues = [
    tip.status,
    tip.settlement_status,
    tip.result_status,
    tip.result
  ].map(cleanStatus).filter(Boolean)

  if (!statusValues.length) return true
  if (statusValues.some(v => ['won', 'lost', 'void', 'win', 'loss', 'wygrany', 'przegrany', 'zwrot'].includes(v))) return false
  return statusValues.some(v => PENDING_VALUES.has(v) || v.includes('pending') || v.includes('oczek'))
}

function getFixtureId(tip = {}) {
  const values = [
    tip.fixture_id,
    tip.api_fixture_id,
    tip.external_fixture_id,
    tip.apiFixtureId,
    tip.fixture_json?.fixture?.id,
    tip.fixture_json?.id,
    tip.raw_fixture?.fixture?.id,
    tip.matchId,
    tip.match_id,
    tip.fixtureId,
    tip.externalFixtureId
  ]
  const found = values.find(v => v !== null && v !== undefined && String(v).trim() && !String(v).startsWith('manual-'))
  return found ? String(found).trim() : ''
}

function marketText(tip = {}) {
  return normalize(`${tip.bet_type || ''} ${tip.prediction || ''} ${tip.market || ''} ${tip.type || ''} ${tip.pick || ''}`)
}

function isHomePick(text, home) {
  const h = normalize(home)
  return text.includes('home') || text === '1' || text.includes(' 1 ') || text.includes('gospod') || text.includes('wygra gospodar') || (h && text.includes(h))
}

function isAwayPick(text, away) {
  const a = normalize(away)
  return text.includes('away') || text === '2' || text.includes(' 2 ') || text.includes('gosc') || text.includes('gosc') || text.includes('wygra gosc') || (a && text.includes(a))
}

function isDrawPick(text) {
  return text.includes('draw') || text.includes('remis') || text === 'x' || text.includes(' x ')
}

function hasExactToken(text, token) {
  // V1661: bez RegExp, żeby Netlify Function nigdy nie crashowała przez błędny regex.
  const raw = String(text || '').toLowerCase()
  const needle = String(token || '').toLowerCase().trim()
  if (!needle) return false
  const compact = raw.replace(/[^a-z0-9]+/g, '')
  if (compact === needle) return true
  const parts = raw.split(/[^a-z0-9]+/).filter(Boolean)
  if (parts.includes(needle)) return true
  return raw.includes(needle)
}

function getCanonicalKeys(tip = {}) {
  return {
    marketKey: normalize(tip.market_key || tip.marketKey || ''),
    selectionKey: normalize(tip.selection_key || tip.selectionKey || ''),
    settlementMode: normalize(tip.settlement_mode || tip.settlementMode || '')
  }
}

function extractLine(text = '') {
  const match = String(text || '').match(/([0-9]+(?:[.,][0-9]+)?)/)
  if (!match) return null
  const value = Number(String(match[1]).replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function isOverText(text = '') {
  const t = normalize(text)
  return t.includes('over') || t.includes('powyzej') || t.includes('powyżej') || t.includes('wiecej') || t.includes('więcej')
}

function isUnderText(text = '') {
  const t = normalize(text)
  return t.includes('under') || t.includes('ponizej') || t.includes('poniżej') || t.includes('mniej')
}

function settleOverUnderValue(text, total, label) {
  const line = extractLine(text)
  if (!Number.isFinite(line)) return null
  if (isOverText(text)) {
    if (total > line) return { status: 'won', reason: `${label} Over ${line}, total=${total}` }
    if (total < line) return { status: 'lost', reason: `${label} Over ${line}, total=${total}` }
    return { status: 'void', reason: `Push ${label} Over ${line}, total=${total}` }
  }
  if (isUnderText(text)) {
    if (total < line) return { status: 'won', reason: `${label} Under ${line}, total=${total}` }
    if (total > line) return { status: 'lost', reason: `${label} Under ${line}, total=${total}` }
    return { status: 'void', reason: `Push ${label} Under ${line}, total=${total}` }
  }
  return null
}

function resolveDoubleChance(tip, homeGoals, awayGoals, fixture) {
  const text = marketText(tip)
  const compact = text.replace(/[^a-z0-9]+/g, '')
  const result = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw'

  // V1658: typy typu X2/1X/12 wcześniej wpadały w pending_admin_review,
  // bo rozliczanie znało tylko klasyczne 1X2. Dla Las Palmas 0:1 i X2 wynik powinien być WON.
  const isDoubleChanceMarket =
    text.includes('podwojna szansa') ||
    text.includes('podwójna szansa') ||
    text.includes('double chance') ||
    text.includes('dc') ||
    compact.includes('podwojnaszansa') ||
    compact.includes('doublechance')

  let pick = null
  if (hasExactToken(text, '1x') || compact === '1x' || compact.includes('podwojnaszansa1x') || compact.includes('doublechance1x')) pick = '1x'
  if (hasExactToken(text, 'x2') || compact === 'x2' || compact.includes('podwojnaszansax2') || compact.includes('doublechancex2')) pick = 'x2'
  if (hasExactToken(text, '12') || compact === '12' || compact.includes('podwojnaszansa12') || compact.includes('doublechance12')) pick = '12'

  // Jeżeli rynek mówi podwójna szansa, a sam pick jest ukryty w prediction/bet_type,
  // wykryj też luźne wystąpienia bez wymagania całego rynku.
  if (!pick && isDoubleChanceMarket) {
    if (text.includes('1x')) pick = '1x'
    else if (text.includes('x2')) pick = 'x2'
    else if (text.includes('12')) pick = '12'
  }

  if (!pick) return null

  const won =
    (pick === '1x' && (result === 'home' || result === 'draw')) ||
    (pick === 'x2' && (result === 'away' || result === 'draw')) ||
    (pick === '12' && (result === 'home' || result === 'away'))

  return { status: won ? 'won' : 'lost', reason: `Podwójna szansa pick=${pick}, result=${result}` }
}

function resolve1x2(tip, homeGoals, awayGoals, fixture) {
  const text = marketText(tip)
  const home = tip.team_home || tip.home_team || fixture?.teams?.home?.name || ''
  const away = tip.team_away || tip.away_team || fixture?.teams?.away?.name || ''
  const result = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw'
  let pick = null

  if (isDrawPick(text)) pick = 'draw'
  else if (isHomePick(text, home)) pick = 'home'
  else if (isAwayPick(text, away)) pick = 'away'

  if (!pick) return { status: 'pending_admin_review', reason: `Nie rozpoznano typu 1X2: ${text}` }
  return { status: pick === result ? 'won' : 'lost', reason: `1X2 pick=${pick}, result=${result}` }
}

function resolveOverUnder(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  const keys = getCanonicalKeys(tip)
  if (keys.marketKey && !['goals_total', ''].includes(keys.marketKey) && !(text.includes('gole') || text.includes('bram') || text.includes('goals'))) return null
  if (text.includes('rog') || text.includes('corner') || text.includes('kart') || text.includes('card')) return null
  const total = homeGoals + awayGoals
  return settleOverUnderValue(text, total, 'Gole')
}

function resolveBtts(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  const compact = text.replace(/[^a-z0-9]+/g, '')
  if (!(text.includes('btts') || text.includes('obie') || text.includes('both teams'))) return null

  // V1662: poprawka BTTS NIE / Both Teams To Score No.
  // Wcześniej samo słowo "btts" ustawiało pick na TAK, więc "BTTS Nie" przy wyniku 2:0
  // było błędnie rozliczane jako przegrane. Teraz najpierw wykrywamy negację.
  const isNo =
    hasExactToken(text, 'nie') ||
    hasExactToken(text, 'no') ||
    text.includes('bez gola obu') ||
    text.includes('obie nie') ||
    text.includes('both teams to score no') ||
    compact.includes('bttsnie') ||
    compact.includes('bttsno') ||
    compact.includes('bothteamstoscoreno')

  const isYes =
    hasExactToken(text, 'tak') ||
    hasExactToken(text, 'yes') ||
    text.includes('obie strzela') ||
    text.includes('obie strzelą') ||
    text.includes('both teams to score yes') ||
    compact.includes('bttstak') ||
    compact.includes('bttsyes') ||
    compact.includes('bothteamstoscoreyes')

  if (!isNo && !isYes) {
    return { status: 'pending_admin_review', reason: `Nie rozpoznano BTTS TAK/NIE: ${text}` }
  }

  const yes = isNo ? false : true
  const hit = homeGoals > 0 && awayGoals > 0
  return { status: yes === hit ? 'won' : 'lost', reason: `BTTS ${yes ? 'TAK' : 'NIE'}, hit=${hit}` }
}

function resolveDnb(tip, homeGoals, awayGoals, fixture) {
  const text = marketText(tip)
  const keys = getCanonicalKeys(tip)
  if (!(keys.marketKey === 'draw_no_bet' || text.includes('dnb') || text.includes('draw no bet') || text.includes('remis nie ma'))) return null
  if (homeGoals === awayGoals) return { status: 'void', reason: 'DNB / remis = zwrot' }
  const home = tip.team_home || tip.home_team || fixture?.teams?.home?.name || ''
  const away = tip.team_away || tip.away_team || fixture?.teams?.away?.name || ''
  let pick = keys.selectionKey === 'home' || keys.selectionKey === 'away' ? keys.selectionKey : null
  if (!pick) {
    if (isHomePick(text, home)) pick = 'home'
    else if (isAwayPick(text, away)) pick = 'away'
  }
  if (!pick) return { status: 'pending_admin_review', reason: `Nie rozpoznano DNB: ${text}` }
  const result = homeGoals > awayGoals ? 'home' : 'away'
  return { status: pick === result ? 'won' : 'lost', reason: `DNB pick=${pick}, result=${result}` }
}

function resolveExactScore(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  const keys = getCanonicalKeys(tip)
  if (!(keys.marketKey === 'exact_score' || text.includes('dokladny wynik') || text.includes('exact score') || text.includes('correct score'))) return null
  const scoreFromKey = keys.selectionKey && keys.selectionKey.match(/^(\d+)_(\d+)$/)
  const scoreFromText = text.match(/(\d+)\s*[:\-]\s*(\d+)/)
  const score = scoreFromKey || scoreFromText
  if (!score) return { status: 'pending_admin_review', reason: `Nie rozpoznano dokładnego wyniku: ${text}` }
  const pickHome = Number(score[1])
  const pickAway = Number(score[2])
  return { status: pickHome === homeGoals && pickAway === awayGoals ? 'won' : 'lost', reason: `Dokładny wynik pick=${pickHome}:${pickAway}, score=${homeGoals}:${awayGoals}` }
}

function resolveHandicap(tip, homeGoals, awayGoals, fixture) {
  const text = marketText(tip)
  const keys = getCanonicalKeys(tip)
  if (!(keys.marketKey === 'handicap' || text.includes('handicap'))) return null
  const home = tip.team_home || tip.home_team || fixture?.teams?.home?.name || ''
  const away = tip.team_away || tip.away_team || fixture?.teams?.away?.name || ''
  const lineMatch = text.match(/([+-]\s*\d+(?:[\.,]\d+)?)/) || String(keys.selectionKey || '').match(/([+-]?\d+(?:[\.,]\d+)?)/)
  if (!lineMatch) return { status: 'pending_admin_review', reason: `Nie rozpoznano handicapu: ${text}` }
  const line = Number(String(lineMatch[1]).replace(/\s+/g, '').replace(',', '.'))
  if (!Number.isFinite(line)) return { status: 'pending_admin_review', reason: `Niepoprawna linia handicapu: ${text}` }
  let pick = null
  if (keys.selectionKey.startsWith('home')) pick = 'home'
  else if (keys.selectionKey.startsWith('away')) pick = 'away'
  else if (isHomePick(text, home)) pick = 'home'
  else if (isAwayPick(text, away)) pick = 'away'
  if (!pick) return { status: 'pending_admin_review', reason: `Nie rozpoznano drużyny handicapu: ${text}` }
  const adjusted = pick === 'home' ? homeGoals + line - awayGoals : awayGoals + line - homeGoals
  if (adjusted > 0) return { status: 'won', reason: `Handicap ${pick} ${line}, adjusted=${adjusted}` }
  if (adjusted < 0) return { status: 'lost', reason: `Handicap ${pick} ${line}, adjusted=${adjusted}` }
  return { status: 'void', reason: `Handicap push ${pick} ${line}` }
}

function statValue(teamStats = [], aliases = []) {
  const wanted = aliases.map(a => normalize(a))
  let sum = 0
  for (const row of Array.isArray(teamStats) ? teamStats : []) {
    const type = normalize(row?.type || row?.name || '')
    if (!wanted.some(alias => type.includes(alias))) continue
    const value = row?.value
    if (typeof value === 'string' && value.includes('%')) continue
    sum += n(value, 0)
  }
  return sum
}

function getTotalCorners(stats = []) {
  return (Array.isArray(stats) ? stats : []).reduce((total, team) => total + statValue(team?.statistics, ['corner kicks', 'corners', 'rzuty rozne', 'rożne']), 0)
}

function getTotalCards(stats = []) {
  return (Array.isArray(stats) ? stats : []).reduce((total, team) => {
    const yellow = statValue(team?.statistics, ['yellow cards', 'yellow card', 'zolte', 'żółte'])
    const red = statValue(team?.statistics, ['red cards', 'red card', 'czerwone'])
    return total + yellow + red
  }, 0)
}

function resolveCornersCards(tip, fixtureStats = []) {
  const text = marketText(tip)
  const keys = getCanonicalKeys(tip)
  const isCorners = keys.marketKey === 'corners_total' || text.includes('rog') || text.includes('corner')
  const isCards = keys.marketKey === 'cards_total' || text.includes('kart') || text.includes('card')
  if (!isCorners && !isCards) return null
  const total = isCorners ? getTotalCorners(fixtureStats) : getTotalCards(fixtureStats)
  if (!Array.isArray(fixtureStats) || !fixtureStats.length) {
    return { status: 'pending_admin_review', reason: `${isCorners ? 'Rogi' : 'Kartki'}: API nie zwróciło statystyk meczu` }
  }
  const result = settleOverUnderValue(text, total, isCorners ? 'Rogi' : 'Kartki')
  return result || { status: 'pending_admin_review', reason: `Nie rozpoznano linii ${isCorners ? 'rogów' : 'kartek'}: ${text}` }
}

function needsFixtureStats(tip = {}) {
  const text = marketText(tip)
  const keys = getCanonicalKeys(tip)
  return keys.marketKey === 'corners_total' || keys.marketKey === 'cards_total' || text.includes('rog') || text.includes('corner') || text.includes('kart') || text.includes('card')
}

function resolveTip(tip, homeGoals, awayGoals, fixture, fixtureStats = []) {
  return resolveCornersCards(tip, fixtureStats) || resolveDnb(tip, homeGoals, awayGoals, fixture) || resolveExactScore(tip, homeGoals, awayGoals) || resolveHandicap(tip, homeGoals, awayGoals, fixture) || resolveOverUnder(tip, homeGoals, awayGoals) || resolveBtts(tip, homeGoals, awayGoals) || resolveDoubleChance(tip, homeGoals, awayGoals, fixture) || resolve1x2(tip, homeGoals, awayGoals, fixture)
}

async function getFixture(fixtureId) {
  const key = apiFootballKey()
  if (!key) throw new Error('Brak API_FOOTBALL_KEY/API_SPORTS_KEY/APISPORTS_KEY w Netlify ENV')
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(fixtureId)}`, {
    headers: { 'x-apisports-key': key, 'x-rapidapi-key': key }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`API-Football HTTP ${response.status}: ${JSON.stringify(payload?.errors || payload).slice(0, 220)}`)
  const row = payload?.response?.[0]
  if (!row) return null
  return row
}


async function getFixtureStatistics(fixtureId) {
  const key = apiFootballKey()
  if (!key) throw new Error('Brak API_FOOTBALL_KEY/API_SPORTS_KEY/APISPORTS_KEY w Netlify ENV')
  const response = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${encodeURIComponent(fixtureId)}`, {
    headers: { 'x-apisports-key': key, 'x-rapidapi-key': key }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return []
  return Array.isArray(payload?.response) ? payload.response : []
}


function parseAkoLegs(tip = {}) {
  const source = tip.legs_json || tip.legs || tip.ako_legs || tip.coupon_legs || null
  if (Array.isArray(source)) return source
  if (typeof source === 'string' && source.trim()) {
    try {
      const parsed = JSON.parse(source)
      if (Array.isArray(parsed)) return parsed
    } catch (_) {}
  }
  return []
}

function isAkoTip(tip = {}) {
  const legs = parseAkoLegs(tip)
  return Boolean(tip.is_ako) || String(tip.coupon_type || '').toLowerCase() === 'ako' || legs.length >= 2
}

function decorateAkoLeg(originalLeg, extra = {}) {
  return { ...originalLeg, ...extra, checked_at: new Date().toISOString() }
}

function buildAkoSettlementPatch(tip, legs, overall, reason) {
  const stake = n(tip.stake, 0)
  const totalOdds = n(tip.odds || tip.course || tip.kurs, 0)
  const effectiveOdds = legs.reduce((product, leg) => {
    const status = String(leg.status || leg.result || '').toLowerCase()
    if (status === 'void') return product
    return product * (n(leg.odds || leg.course || leg.price, 1) || 1)
  }, 1)
  const winOdds = totalOdds > 1 ? totalOdds : effectiveOdds
  const payout = overall === 'won' ? +(stake * winOdds).toFixed(2) : overall === 'void' ? stake : overall === 'lost' ? 0 : null
  const profit = overall === 'won' ? +((payout || 0) - stake).toFixed(2) : overall === 'void' ? 0 : overall === 'lost' ? -stake : null
  const final = ['won', 'lost', 'void'].includes(overall)

  const patch = {
    legs_json: legs,
    legs_count: Math.max(Number(tip.legs_count || 0) || 0, legs.length),
    coupon_type: 'ako',
    is_ako: true,
    settlement_note: reason || null,
    fixture_json: { ako_legs: legs },
    updated_at: new Date().toISOString()
  }

  if (final) {
    Object.assign(patch, {
      status: overall,
      result: overall,
      settlement_status: overall,
      result_status: overall,
      manual_settlement_status: null,
      admin_approval_status: 'not_required',
      payout,
      return_amount: payout,
      profit,
      settled_at: new Date().toISOString(),
      settled_by: 'auto_api_football_ako_v1655',
      settlement_source: 'api-football-ako'
    })
  } else {
    Object.assign(patch, {
      status: 'pending',
      result: 'pending',
      settlement_status: 'pending',
      result_status: 'pending',
      admin_approval_status: 'not_required'
    })
  }

  return patch
}

async function resolveAkoTip(tip) {
  const originalLegs = parseAkoLegs(tip)
  const nextLegs = []
  const reasons = []
  let hasLost = false
  let hasPending = false
  let hasWon = false
  let hasVoid = false
  let hasStarted = false

  for (let index = 0; index < originalLegs.length; index += 1) {
    const leg = originalLegs[index] || {}
    const fixtureId = getFixtureId(leg)
    if (!fixtureId) {
      hasPending = true
      nextLegs.push(decorateAkoLeg(leg, { status: leg.status || 'pending', result: leg.result || 'pending', reason: 'Brak fixture_id dla zdarzenia AKO' }))
      continue
    }

    const fixture = await getFixture(fixtureId)
    if (!fixture) {
      hasPending = true
      nextLegs.push(decorateAkoLeg(leg, { status: 'pending', result: 'pending', fixture_id: fixtureId, reason: 'Nie znaleziono meczu w API' }))
      continue
    }

    const status = fixture?.fixture?.status?.short || ''
    const homeGoals = n(fixture?.goals?.home, 0)
    const awayGoals = n(fixture?.goals?.away, 0)
    const score = `${homeGoals}:${awayGoals}`
    const fixtureDate = fixture?.fixture?.date || leg.commence_time || leg.date || null

    if (LIVE_STATUS.has(status)) {
      hasPending = true
      hasStarted = true
      nextLegs.push(decorateAkoLeg(leg, { status: 'live', result: 'pending', fixture_id: fixtureId, fixture_status: status, score, fixture_date: fixtureDate, reason: `Mecz rozpoczęty: ${status}` }))
      continue
    }

    if (VOID_STATUS.has(status)) {
      hasVoid = true
      hasStarted = true
      nextLegs.push(decorateAkoLeg(leg, { status: 'void', result: 'void', fixture_id: fixtureId, fixture_status: status, score, fixture_date: fixtureDate, reason: `Zwrot: ${status}` }))
      continue
    }

    if (!FINISHED_STATUS.has(status)) {
      hasPending = true
      nextLegs.push(decorateAkoLeg(leg, { status: leg.status || 'pending', result: leg.result || 'pending', fixture_id: fixtureId, fixture_status: status, score, fixture_date: fixtureDate, reason: `Oczekuje: ${status || 'NS'}` }))
      continue
    }

    hasStarted = true
    const legTip = {
      ...tip,
      ...leg,
      fixture_id: fixtureId,
      team_home: leg.home || leg.team_home || tip.team_home,
      team_away: leg.away || leg.team_away || tip.team_away,
      home_team: leg.home || leg.home_team || tip.home_team,
      away_team: leg.away || leg.away_team || tip.away_team,
      market: leg.market || tip.market,
      bet_type: leg.pick || leg.bet_type || leg.prediction || tip.bet_type,
      prediction: leg.pick || leg.prediction || leg.bet_type || tip.prediction,
      pick: leg.pick || tip.pick,
      odds: leg.odds || tip.odds
    }
    const fixtureStats = needsFixtureStats(legTip) ? await getFixtureStatistics(fixtureId) : []
    const result = resolveTip(legTip, homeGoals, awayGoals, fixture, fixtureStats)
    const finalStatus = result.status === 'pending_admin_review' ? 'pending_admin_review' : result.status
    if (finalStatus === 'lost') hasLost = true
    else if (finalStatus === 'won') hasWon = true
    else if (finalStatus === 'void') hasVoid = true
    else hasPending = true

    reasons.push(`${index + 1}. ${leg.home || leg.team_home || ''} - ${leg.away || leg.team_away || ''}: ${finalStatus} (${result.reason || ''})`)
    nextLegs.push(decorateAkoLeg(leg, { status: finalStatus, result: finalStatus, fixture_id: fixtureId, fixture_status: status, score, fixture_date: fixtureDate, reason: result.reason || null }))
  }

  let overall = 'pending'
  let reason = reasons.join(' | ')
  if (hasLost) {
    overall = 'lost'
    reason = `AKO przegrane — co najmniej jedno zdarzenie nietrafione. ${reason}`.trim()
  } else if (!hasPending && originalLegs.length && hasWon) {
    overall = 'won'
    reason = `AKO wygrane — wszystkie aktywne zdarzenia trafione. ${reason}`.trim()
  } else if (!hasPending && originalLegs.length && hasVoid && !hasWon) {
    overall = 'void'
    reason = `AKO zwrot — wszystkie zdarzenia anulowane/zwrotne. ${reason}`.trim()
  } else if (hasStarted) {
    reason = `AKO w toku — część zdarzeń już rozpoczęta lub rozliczona, kupon zostaje oczekujący.`
  } else {
    reason = `AKO oczekuje — żadne zdarzenie nie wymaga jeszcze rozliczenia.`
  }

  return { overall, legs: nextLegs, reason }
}

function buildSettlementPatch(tip, fixture, result) {
  const homeGoals = n(fixture?.goals?.home, 0)
  const awayGoals = n(fixture?.goals?.away, 0)
  const stake = n(tip.stake, 0)
  const odds = n(tip.odds || tip.course || tip.kurs, 0)
  const payout = result.status === 'won' ? +(stake * odds).toFixed(2) : result.status === 'void' ? stake : 0
  const profit = result.status === 'won' ? +(payout - stake).toFixed(2) : result.status === 'void' ? 0 : -stake

  return {
    status: result.status,
    result: result.status,
    settlement_status: result.status,
    result_status: result.status,
    manual_settlement_status: null,
    admin_approval_status: result.status === 'pending_admin_review' ? 'pending' : 'not_required',
    final_score_home: homeGoals,
    final_score_away: awayGoals,
    result_home: homeGoals,
    result_away: awayGoals,
    payout,
    return_amount: payout,
    profit,
    settled_at: result.status === 'pending_admin_review' ? null : new Date().toISOString(),
    settled_by: result.status === 'pending_admin_review' ? null : 'auto_api_football_v1038',
    settlement_source: 'api-football',
    settlement_note: result.reason || null,
    fixture_status: fixture?.fixture?.status?.short || null,
    fixture_json: fixture
  }
}

async function safeUpdateTip(supabase, id, patch) {
  let current = { ...patch }
  let lastError = null
  for (let i = 0; i < 30; i += 1) {
    const { data, error } = await supabase.from('tips').update(current).eq('id', id).select('*').maybeSingle()
    if (!error) return { data, error: null, usedPatch: current }
    lastError = error
    const msg = String(error.message || '')
    const missing = msg.match(/'([^']+)' column of 'tips'/)?.[1] || msg.match(/column "([^"]+)" of relation "tips" does not exist/)?.[1]
    if (!missing || !(missing in current)) break
    delete current[missing]
  }
  return { data: null, error: lastError, usedPatch: current }
}

async function fetchCandidateTips(supabase, limit, specificId = '') {
  if (specificId) {
    const { data, error } = await supabase.from('tips').select('*').eq('id', specificId).limit(1)
    if (error) throw error
    return data || []
  }

  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).filter(tip => isPendingTip(tip) && (isAkoTip(tip) || getFixtureId(tip)))
}

async function runAutoSettle({ limit = 500, dryRun = false, specificId = '' } = {}) {
  const supabase = getSupabaseAdmin()
  const tips = await fetchCandidateTips(supabase, limit, specificId)

  const checked = []
  const settled = []
  const skipped = []
  const failed = []

  for (const tip of tips || []) {
    const fixtureId = getFixtureId(tip)
    const base = {
      id: tip.id,
      status: tip.status,
      settlement_status: tip.settlement_status,
      fixtureId,
      home: tip.team_home || tip.home_team,
      away: tip.team_away || tip.away_team,
      pick: tip.bet_type || tip.prediction || tip.market || tip.type
    }
    checked.push(base)

    if (isAkoTip(tip)) {
      try {
        const akoResult = await resolveAkoTip(tip)
        const patch = buildAkoSettlementPatch(tip, akoResult.legs, akoResult.overall, akoResult.reason)
        if (!dryRun) {
          const update = await safeUpdateTip(supabase, tip.id, patch)
          if (update.error) throw update.error
        }
        const payload = { ...base, status: akoResult.overall, reason: akoResult.reason, legs: akoResult.legs.length, dryRun }
        if (akoResult.overall === 'pending') skipped.push(payload)
        else settled.push(payload)
      } catch (error) {
        failed.push({ ...base, error: String(error.message || error) })
      }
      continue
    }

    if (!fixtureId) {
      skipped.push({ ...base, reason: 'no fixture_id/api_fixture_id/external_fixture_id' })
      continue
    }

    try {
      const fixture = await getFixture(fixtureId)
      if (!fixture) {
        skipped.push({ ...base, reason: 'fixture not found in API-Football' })
        continue
      }

      const status = fixture?.fixture?.status?.short
      const homeGoals = n(fixture?.goals?.home, 0)
      const awayGoals = n(fixture?.goals?.away, 0)

      if (VOID_STATUS.has(status)) {
        const patch = buildSettlementPatch(tip, fixture, { status: 'void', reason: `Fixture status ${status}` })
        if (!dryRun) {
          const update = await safeUpdateTip(supabase, tip.id, patch)
          if (update.error) throw update.error
        }
        settled.push({ ...base, status: 'void', fixtureStatus: status, score: `${homeGoals}:${awayGoals}`, dryRun })
        continue
      }

      if (!FINISHED_STATUS.has(status)) {
        skipped.push({ ...base, reason: `not finished: ${status || 'unknown'}`, score: `${homeGoals}:${awayGoals}` })
        continue
      }

      const fixtureStats = needsFixtureStats(tip) ? await getFixtureStatistics(fixtureId) : []
      const result = resolveTip(tip, homeGoals, awayGoals, fixture, fixtureStats)
      const patch = buildSettlementPatch(tip, fixture, result)

      if (!dryRun) {
        const update = await safeUpdateTip(supabase, tip.id, patch)
        if (update.error) throw update.error
      }

      if (result.status === 'pending_admin_review') {
        skipped.push({ ...base, reason: result.reason, fixtureStatus: status, score: `${homeGoals}:${awayGoals}`, dryRun })
      } else {
        settled.push({ ...base, status: result.status, reason: result.reason, fixtureStatus: status, score: `${homeGoals}:${awayGoals}`, dryRun })
      }
    } catch (error) {
      failed.push({ ...base, error: String(error.message || error) })
    }
  }

  return { checkedCount: checked.length, checked, settled, skipped, failed }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }

  try {
    const qs = event.queryStringParameters || {}
    const limit = Math.max(1, Math.min(500, Number(qs.limit || 500) || 500))
    const dryRun = String(qs.dryRun || '') === '1'
    const specificId = String(qs.id || '').trim()

    const result = await runAutoSettle({ limit, dryRun, specificId })
    return json(200, { ok: true, function: 'auto-settle-tips-v1663', dryRun, ...result })
  } catch (error) {
    console.error('auto-settle-tips v1663 error:', error)
    return json(500, { ok: false, function: 'auto-settle-tips-v1663', error: String(error.message || error) })
  }
}

exports.config = {
  schedule: '*/5 * * * *'
}
