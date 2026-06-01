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
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  }
}
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback }
function scoreN(v) { if (v === undefined || v === null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null }
function norm(s) { return String(s || '').toLowerCase().trim() }
function cleanName(s) { return norm(s).replace(/\s+/g, ' ') }
function includesName(text, name) { const a = cleanName(text); const b = cleanName(name); return b && (a.includes(b) || b.includes(a)) }
function profitFromStatus(status, odds, stake = 100) {
  if (status === 'won') return Math.round((n(odds, 1) - 1) * stake)
  if (status === 'lost') return -stake
  return 0
}

const FOOTBALL_API = { host: 'https://v3.football.api-sports.io', path: '/fixtures', type: 'football' }

function tipDateKey(tip) {
  if (tip.match_date) return String(tip.match_date).slice(0, 10)
  const raw = tip.event_time || tip.kickoff_time || tip.match_time || tip.created_at || ''
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return String(raw || '').slice(0, 10)
}
function itemTeams(item = {}) {
  const home = item?.teams?.home?.name || item?.teams?.home || item?.home?.name || item?.team?.home?.name || ''
  const away = item?.teams?.away?.name || item?.teams?.visitors?.name || item?.teams?.away || item?.away?.name || item?.team?.away?.name || ''
  return { home: String(home || ''), away: String(away || '') }
}
function sameMatchByNames(tip, item) {
  const teams = itemTeams(item)
  const home = tip.home_team || tip.team_home || String(tip.match_name || tip.match || '').split(' vs ')[0]
  const away = tip.away_team || tip.team_away || String(tip.match_name || tip.match || '').split(' vs ')[1]
  return includesName(teams.home, home) && includesName(teams.away, away)
}
async function fetchApiSportsResult(tip) {
  const directId = tip.external_fixture_id || tip.ai_external_key
  const headers = { 'x-apisports-key': APISPORTS_KEY }

  async function request(url) {
    const res = await fetch(url, { headers })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = null }
    if (!res.ok) throw new Error(`football result API ${res.status}: ${text.slice(0, 160)}`)
    const errors = data?.errors && typeof data.errors === 'object' ? Object.keys(data.errors).filter(k => data.errors[k]) : []
    if (errors.length) throw new Error(`football result API errors: ${JSON.stringify(data.errors).slice(0, 200)}`)
    return Array.isArray(data?.response) ? data.response : []
  }

  if (directId && /^\d+$/.test(String(directId))) {
    const rows = await request(`${FOOTBALL_API.host}${FOOTBALL_API.path}?id=${encodeURIComponent(directId)}`)
    if (rows[0]) return rows[0]
  }

  const date = tipDateKey(tip)
  if (!date) return null
  const rows = await request(`${FOOTBALL_API.host}${FOOTBALL_API.path}?date=${encodeURIComponent(date)}`)
  return rows.find(row => sameMatchByNames(tip, row)) || null
}
function getStatus(item) {
  const raw = item?.fixture?.status?.short || item?.fixture?.status?.long || item?.status?.short || item?.status?.long || item?.status || ''
  return String(raw || '').toUpperCase()
}
function isFinishedStatus(status) {
  const s = String(status || '').toUpperCase()
  return ['FT','AET','PEN','FINISHED','FINAL','ENDED','AFTER OVER TIME','AFTER PENALTIES'].some(x => s.includes(x))
}
function extractScore(item) {
  return {
    home: scoreN(item?.goals?.home ?? item?.score?.fulltime?.home ?? item?.score?.extratime?.home ?? item?.score?.penalty?.home),
    away: scoreN(item?.goals?.away ?? item?.score?.fulltime?.away ?? item?.score?.extratime?.away ?? item?.score?.penalty?.away)
  }
}
function resolvePick(tip, homeScore, awayScore) {
  const total = n(homeScore) + n(awayScore)
  const pick = norm(`${tip.pick || tip.selection || tip.prediction || ''}`)
  const market = norm(`${tip.market || tip.bet_type || ''}`)
  const homeName = tip.home_team || tip.team_home || String(tip.match_name || tip.match || '').split(' vs ')[0]
  const awayName = tip.away_team || tip.team_away || String(tip.match_name || tip.match || '').split(' vs ')[1]
  const isHome = includesName(pick, homeName) || pick.includes('home') || pick.includes('gospod')
  const isAway = includesName(pick, awayName) || pick.includes('away') || pick.includes('gość') || pick.includes('gosc')
  const over = pick.match(/(?:over|powyżej|powyzej)\s*(\d+(?:[.,]\d+)?)/i)
  const under = pick.match(/(?:under|poniżej|ponizej)\s*(\d+(?:[.,]\d+)?)/i)
  if (over) return total > Number(over[1].replace(',', '.')) ? 'won' : 'lost'
  if (under) return total < Number(under[1].replace(',', '.')) ? 'won' : 'lost'
  if (pick.includes('btts yes') || pick.includes('btts tak') || pick.includes('obie strzelą') || pick.includes('obie strzela')) return (homeScore > 0 && awayScore > 0) ? 'won' : 'lost'
  if (pick.includes('btts no') || pick.includes('btts nie')) return (homeScore === 0 || awayScore === 0) ? 'won' : 'lost'
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
async function getTableColumns(supabase, tableName) {
  try {
    const { data } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
    if (Array.isArray(data)) return new Set(data.map(r => r.column_name))
  } catch (_) {}
  // fallback: podstawowa struktura, którą pokazał użytkownik
  return new Set(['id','external_fixture_id','match_date','match_time','home_team','away_team','country','league','market','prediction','odds','probability','ev','ai_score','status','result','profit','source','created_at','updated_at'])
}
function pickExistingColumns(update, columns) {
  return Object.fromEntries(Object.entries(update).filter(([key]) => columns.has(key)))
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !APISPORTS_KEY) return json(500, { error: 'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY albo APISPORTS_KEY.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const columns = await getTableColumns(supabase, 'ai_bets')
    const { data: bets, error } = await supabase
      .from('ai_bets')
      .select('*')
      .in('status', ['pending', 'live', 'started', ''])
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })
      .limit(500)
    if (error) throw error

    const isSettled = bet => ['won','lost','void','win','loss','push'].includes(norm(bet.status || bet.result))
    const candidates = (bets || []).filter(bet => !isSettled(bet))

    let settled = 0, checked = 0, skipped = 0
    const errors = []
    const updated = []

    for (const bet of candidates) {
      checked++
      try {
        const item = await fetchApiSportsResult(bet)
        if (!item) { skipped++; continue }
        const statusRaw = getStatus(item)
        if (!isFinishedStatus(statusRaw)) { skipped++; continue }
        const score = extractScore(item)
        if (score.home == null || score.away == null) { skipped++; continue }

        const computedStatus = resolvePick(bet, score.home, score.away)
        const result = computedStatus === 'won' ? 'won' : computedStatus === 'lost' ? 'lost' : 'void'
        const update = pickExistingColumns({
          status: computedStatus,
          result,
          profit: profitFromStatus(computedStatus, bet.odds, 100),
          live_score_home: scoreN(score.home),
          live_score_away: scoreN(score.away),
          score_home: scoreN(score.home),
          score_away: scoreN(score.away),
          home_score: scoreN(score.home),
          away_score: scoreN(score.away),
          live_status: statusRaw || 'FT',
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, columns)

        const { error: upErr } = await supabase.from('ai_bets').update(update).eq('id', bet.id)
        if (upErr) throw upErr
        settled++
        updated.push({ id: bet.id, match: `${bet.home_team} vs ${bet.away_team}`, status: computedStatus, score })
      } catch (e) {
        errors.push({ id: bet.id, match: `${bet.home_team || ''} vs ${bet.away_team || ''}`.trim(), error: e.message || String(e) })
      }
    }

    try {
      await supabase.from('ai_pick_runs').insert({
        source: 'settle-ai-bets-v1498',
        picks_created: settled,
        status: errors.length ? 'partial' : 'success',
        error_message: errors.length ? JSON.stringify(errors).slice(0, 1000) : null,
        finished_at: new Date().toISOString()
      })
    } catch (_) {}

    return json(200, { checked, settled, skipped, updated, errors: errors.slice(0, 20) })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Settle error' })
  }
}
