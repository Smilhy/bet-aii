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
function resolvePick(tip, homeScore, awayScore) {
  const total = n(homeScore) + n(awayScore)
  const pick = norm(`${tip.pick || tip.selection || tip.prediction || ''}`)
  const market = norm(`${tip.market || tip.bet_type || ''}`)
  const homeName = tipHome(tip)
  const awayName = tipAway(tip)
  const isHome = includesName(pick, homeName) || pick.includes('home') || pick.includes('gospod') || pick.includes('1') && market.includes('1x2')
  const isAway = includesName(pick, awayName) || pick.includes('away') || pick.includes('gość') || pick.includes('gosc') || pick.includes('2') && market.includes('1x2')
  const over = pick.match(/(?:over|powyżej|powyzej)\s*(\d+(?:[.,]\d+)?)/i)
  const under = pick.match(/(?:under|poniżej|ponizej)\s*(\d+(?:[.,]\d+)?)/i)
  if (over) return total > Number(over[1].replace(',', '.')) ? 'won' : 'lost'
  if (under) return total < Number(under[1].replace(',', '.')) ? 'won' : 'lost'

  // FIX 1748:
  // BTTS w Typy AI wcześniej wpadał w VOID dla polskiego wariantu:
  // "Obie drużyny strzelą: TAK/NIE", bo settlement rozpoznawał tylko "btts no"
  // albo skrócone "obie strzelą". Teraz obsługujemy pełne polskie i angielskie warianty.
  const bttsRaw = `${market} ${pick}`
  const bttsText = bttsRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const bttsCompact = bttsText.replace(/[^a-z0-9]+/g, '')
  const isBtts =
    bttsCompact.includes('btts') ||
    bttsCompact.includes('bothteamstoscore') ||
    bttsCompact.includes('obiedruzynystrzela') ||
    bttsCompact.includes('obiestrzela')
  if (isBtts) {
    const wantsNo =
      bttsCompact.includes('bttsno') ||
      bttsCompact.includes('bothteamstoscoreno') ||
      bttsCompact.includes('obiedruzynystrzelanie') ||
      bttsCompact.includes('obiestrzelanie') ||
      /(^|\s)(no|nie)($|\s)/.test(bttsText)
    const bothScored = homeScore > 0 && awayScore > 0
    return wantsNo ? (!bothScored ? 'won' : 'lost') : (bothScored ? 'won' : 'lost')
  }
  const handicap = pick.match(/([+-]\s*\d+(?:[.,]\d+)?)/)
  if (handicap && (market.includes('handicap') || pick.includes('+') || pick.includes('-'))) {
    const line = Number(handicap[1].replace(/\s+/g, '').replace(',', '.'))
    if (Number.isFinite(line)) {
      const adjustedHome = n(homeScore) + (isHome ? line : 0)
      const adjustedAway = n(awayScore) + (isAway ? line : 0)
      if (isHome) return adjustedHome > n(awayScore) ? 'won' : adjustedHome === n(awayScore) ? 'void' : 'lost'
      if (isAway) return adjustedAway > n(homeScore) ? 'won' : adjustedAway === n(homeScore) ? 'void' : 'lost'
    }
  }
  if (pick.includes('nie przegra') || market.includes('double') || market.includes('podwójna') || market.includes('podwojna') || pick.includes('lub remis')) {
    if (homeScore === awayScore) return 'won'
    if (isHome) return homeScore > awayScore ? 'won' : 'lost'
    if (isAway) return awayScore > homeScore ? 'won' : 'lost'
  }
  if (market.includes('draw no bet') || pick.includes('dnb')) {
    if (homeScore === awayScore) return 'void'
    if (isHome) return homeScore > awayScore ? 'won' : 'lost'
    if (isAway) return awayScore > homeScore ? 'won' : 'lost'
  }
  if (pick.includes('remis') || pick === 'draw') return homeScore === awayScore ? 'won' : 'lost'
  if (isHome) return homeScore > awayScore ? 'won' : 'lost'
  if (isAway) return awayScore > homeScore ? 'won' : 'lost'
  return 'void'
}
async function updateAiBet(supabase, id, fullUpdate, minimalUpdate) {
  const first = await supabase.from('ai_bets').update(fullUpdate).eq('id', id)
  if (!first.error) return { ok: true, fallback: false }
  const msg = String(first.error.message || '')
  if (!/column|schema|does not exist|Could not find/i.test(msg)) throw first.error
  const second = await supabase.from('ai_bets').update(minimalUpdate).eq('id', id)
  if (second.error) throw second.error
  return { ok: true, fallback: true, firstError: msg }
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

    const isSettled = tip => ['won','lost','void','win','loss','push'].includes(norm(tip.status || tip.result || tip.result_status))
    const isPending = tip => ['pending','live',''].includes(norm(tip.status || tip.result || tip.result_status))
    const hasScore = tip => scoreN(tip.live_score_home ?? tip.score_home ?? tip.home_score ?? tip.final_score_home ?? tip.goals_home) !== null && scoreN(tip.live_score_away ?? tip.score_away ?? tip.away_score ?? tip.final_score_away ?? tip.goals_away) !== null
    const hasVerifiedScore = tip => hasScore(tip) && Boolean(tip.live_status || tip.settlement_source === 'auto_ai_result_api')
    const now = Date.now()
    const candidates = (rows || []).filter(tip => {
      if (!(isPending(tip) || !hasVerifiedScore(tip))) return false
      const d = new Date(`${tip.match_date || tipDateKey(tip)}T${String(tip.match_time || '23:59').slice(0,5)}:00`)
      return Number.isNaN(d.getTime()) || d.getTime() < now + 3 * 60 * 60 * 1000
    })

    let settled = 0, checked = 0, skipped = 0, backfilled = 0, fallbackUpdates = 0
    const errors = []
    for (const tip of candidates) {
      checked++
      try {
        const { cfg, item } = await fetchApiSportsResult(tip)
        if (!item) { skipped++; continue }
        const statusRaw = getStatus(item, cfg)
        if (!isFinishedStatus(statusRaw)) { skipped++; continue }
        const score = extractScore(item, cfg)
        if (score.home == null || score.away == null) { skipped++; continue }

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
          (
            isBttsTip(tip) ||
            norm(`${tip.market || ''} ${tip.bet_type || ''} ${tip.prediction || ''}`).includes('gole') ||
            norm(`${tip.market || ''} ${tip.bet_type || ''}`).includes('goals')
          )

        const shouldResolveStatus = isPending(tip) || !isSettled(tip) || shouldResettleWrongVoid
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
        if (shouldResolveStatus) settled++
        else backfilled++
      } catch (e) {
        errors.push({ id: tip.id, match: `${tipHome(tip)} vs ${tipAway(tip)}`, date: tip.match_date, error: e.message || String(e) })
      }
    }
    try {
      await supabase
        .from('ai_pick_runs')
        .insert({
          source: 'settle-ai-bets-v1749-btts-void-resettle-fix',
          picks_created: settled,
          status: errors.length ? 'partial' : 'success',
          finished_at: new Date().toISOString(),
          message: `checked=${checked}; settled=${settled}; backfilled=${backfilled}; skipped=${skipped}; fallbackUpdates=${fallbackUpdates}; errors=${errors.length}`
        })
    } catch (_) {
      // Log run jest pomocniczy. Nie może wysadzać settlementu ani mulić strony.
    }
    return json(200, { version: '1749-settle-live-ai-picks-btts-void-resettle-fix', table: 'ai_bets', checked, settled, backfilled, skipped, fallbackUpdates, errors: errors.slice(0, 20) })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Settle error' })
  }
}
