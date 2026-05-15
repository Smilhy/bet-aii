const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APISPORTS_KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback }
function norm(s) { return String(s || '').toLowerCase().trim() }
function cleanName(s) { return norm(s).replace(/\s+/g, ' ') }
function includesName(text, name) { const a = cleanName(text); const b = cleanName(name); return b && (a.includes(b) || b.includes(a)) }
function profitFromStatus(status, odds, stake = 100) {
  if (status === 'won') return Math.round((n(odds, 1) - 1) * stake)
  if (status === 'lost') return -stake
  return 0
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
  const text = norm(`${tip.sport || ''} ${tip.league || ''} ${tip.league_name || ''}`)
  return SPORT_RESULT_APIS.find(c => c.match.some(x => text.includes(x))) || SPORT_RESULT_APIS[0]
}
function tipDateKey(tip) {
  const raw = tip.event_time || tip.kickoff_time || tip.match_time || tip.created_at || ''
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return String(raw || '').slice(0, 10)
}
function itemTeams(item = {}) {
  const home = item?.teams?.home?.name || item?.teams?.home || item?.home?.name || item?.team?.home?.name || item?.fighters?.first?.name || item?.fighters?.home?.name || ''
  const away = item?.teams?.away?.name || item?.teams?.visitors?.name || item?.teams?.away || item?.away?.name || item?.team?.away?.name || item?.fighters?.second?.name || item?.fighters?.away?.name || ''
  return { home: String(home || ''), away: String(away || '') }
}
function sameMatchByNames(tip, item) {
  const teams = itemTeams(item)
  const home = tip.team_home || String(tip.match_name || '').split(' vs ')[0]
  const away = tip.team_away || String(tip.match_name || '').split(' vs ')[1]
  return includesName(teams.home, home) && includesName(teams.away, away)
}
async function fetchApiSportsResult(tip) {
  const cfg = cfgForTip(tip)
  const directId = tip.external_fixture_id || tip.ai_external_key
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

  // Fallback dla starszych zapisów bez external_fixture_id: szukamy po dacie i nazwach drużyn.
  const date = tipDateKey(tip)
  if (!date) return { cfg, item: null }
  const rows = await request(`${cfg.host}${cfg.path}?date=${encodeURIComponent(date)}`)
  return { cfg, item: rows.find(row => sameMatchByNames(tip, row)) || null }
}
function getStatus(item, cfg) {
  const raw = item?.fixture?.status?.short || item?.fixture?.status?.long || item?.game?.status?.short || item?.game?.status?.long || item?.status?.short || item?.status?.long || item?.status || item?.fight?.status || ''
  return String(raw || '').toUpperCase()
}
function isFinishedStatus(status) {
  const s = String(status || '').toUpperCase()
  return ['FT','AET','PEN','AOT','AP','FINISHED','FINISH','FINAL','ENDED','AFTER OVER TIME','AFTER PENALTIES'].some(x => s.includes(x))
}
function extractScore(item, cfg) {
  if (cfg.type === 'football') return { home: n(item?.goals?.home), away: n(item?.goals?.away) }
  if (cfg.type === 'fight') {
    const f1Win = item?.fighters?.first?.winner ?? item?.fighters?.home?.winner
    const f2Win = item?.fighters?.second?.winner ?? item?.fighters?.away?.winner
    if (f1Win === true) return { home: 1, away: 0 }
    if (f2Win === true) return { home: 0, away: 1 }
    return { home: null, away: null }
  }
  return {
    home: n(item?.scores?.home?.total ?? item?.score?.home ?? item?.teams?.home?.score ?? item?.game?.scores?.home?.total),
    away: n(item?.scores?.away?.total ?? item?.score?.away ?? item?.teams?.away?.score ?? item?.teams?.visitors?.score ?? item?.game?.scores?.away?.total)
  }
}
function resolvePick(tip, homeScore, awayScore) {
  const total = n(homeScore) + n(awayScore)
  const pick = norm(`${tip.pick || tip.selection || tip.prediction || ''}`)
  const market = norm(`${tip.market || tip.bet_type || ''}`)
  const homeName = tip.team_home || String(tip.match_name || '').split(' vs ')[0]
  const awayName = tip.team_away || String(tip.match_name || '').split(' vs ')[1]
  const isHome = includesName(pick, homeName) || pick.includes('home') || pick.includes('gospod')
  const isAway = includesName(pick, awayName) || pick.includes('away') || pick.includes('gość') || pick.includes('gosc')
  const over = pick.match(/(?:over|powyżej|powyzej)\s*(\d+(?:[.,]\d+)?)/i)
  const under = pick.match(/(?:under|poniżej|ponizej)\s*(\d+(?:[.,]\d+)?)/i)
  if (over) return total > Number(over[1].replace(',', '.')) ? 'won' : 'lost'
  if (under) return total < Number(under[1].replace(',', '.')) ? 'won' : 'lost'
  if (pick.includes('btts yes') || pick.includes('obie strzelą') || pick.includes('obie strzela')) return (homeScore > 0 && awayScore > 0) ? 'won' : 'lost'
  if (pick.includes('btts no')) return (homeScore === 0 || awayScore === 0) ? 'won' : 'lost'
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
  if (pick.includes('nie przegra') || market.includes('double') || market.includes('podwójna') || market.includes('podwojna')) {
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

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !APISPORTS_KEY) return json(500, { error: 'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY albo APISPORTS_KEY.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: tips, error } = await supabase
      .from('tips')
      .select('*')
      .eq('ai_source', 'real_ai_engine')
      .eq('source', 'live_ai_engine')
      .in('status', ['pending','live'])
      .order('event_time', { ascending: true })
      .limit(150)
    if (error) throw error

    let settled = 0, checked = 0, skipped = 0
    const errors = []
    for (const tip of tips || []) {
      checked++
      try {
        const { cfg, item } = await fetchApiSportsResult(tip)
        if (!item) { skipped++; continue }
        const statusRaw = getStatus(item, cfg)
        if (!isFinishedStatus(statusRaw)) { skipped++; continue }
        const score = extractScore(item, cfg)
        if (score.home == null || score.away == null) { skipped++; continue }
        const status = resolvePick(tip, score.home, score.away)
        const result = status === 'won' ? 'win' : status === 'lost' ? 'loss' : 'void'
        const update = {
          status,
          result,
          profit: profitFromStatus(status, tip.odds, n(tip.stake, 100) || 100),
          live_score_home: n(score.home),
          live_score_away: n(score.away),
          live_status: statusRaw || 'FT',
          result_status: status,
          settlement_source: 'auto_ai_result_api',
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        const { error: upErr } = await supabase.from('tips').update(update).eq('id', tip.id)
        if (upErr) throw upErr
        settled++
      } catch (e) {
        errors.push({ id: tip.id, match: tip.match_name, sport: tip.sport, error: e.message || String(e) })
      }
    }
    await supabase.from('ai_pick_runs').insert({ source: 'settle-live-ai-picks-v743', picks_created: settled, status: errors.length ? 'partial' : 'success', finished_at: new Date().toISOString(), message: `checked=${checked}; settled=${settled}; skipped=${skipped}; errors=${errors.length}` }).catch(() => {})
    return json(200, { checked, settled, skipped, errors: errors.slice(0, 20) })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Settle error' })
  }
}
