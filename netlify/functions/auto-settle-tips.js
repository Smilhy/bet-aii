
const { createClient } = require('@supabase/supabase-js')

const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN'])
const VOID_STATUS = new Set(['CANC', 'ABD', 'AWD', 'WO', 'PST'])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w Netlify ENV')
  return createClient(url, key, { auth: { persistSession: false } })
}

function apiFootballKey() {
  return process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY || process.env.API_SPORTS_KEY || ''
}

function n(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function marketText(tip = {}) {
  return normalize(`${tip.bet_type || ''} ${tip.prediction || ''} ${tip.market || ''} ${tip.type || ''}`)
}

function isHomePick(text, home) {
  const h = normalize(home)
  return text.includes('home') || text.includes('1') || text.includes('gospod') || (h && text.includes(h)) || text.includes('wygra gospodar')
}

function isAwayPick(text, away) {
  const a = normalize(away)
  return text.includes('away') || text.includes('2') || text.includes('gosc') || text.includes('gość') || (a && text.includes(a)) || text.includes('wygra gosc') || text.includes('wygra gość')
}

function isDrawPick(text) {
  return text.includes('draw') || text.includes('remis') || text === 'x' || text.includes(' x ')
}

function resolve1x2(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  const home = tip.team_home || tip.home_team || ''
  const away = tip.team_away || tip.away_team || ''
  const result = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw'
  let pick = null
  if (isDrawPick(text)) pick = 'draw'
  else if (isHomePick(text, home)) pick = 'home'
  else if (isAwayPick(text, away)) pick = 'away'
  if (!pick) return { status: 'manual_review', reason: 'Nie rozpoznano rynku typu — wymaga admina.' }
  return { status: pick === result ? 'won' : 'lost', reason: `1X2 pick=${pick}, result=${result}` }
}

function resolveOverUnder(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  const total = homeGoals + awayGoals
  const match = text.match(/(?:over|under|powyzej|powyżej|ponizej|poniżej|o\/u|ou)\s*([0-9]+(?:[.,][0-9]+)?)/i) || text.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:gola|bram|pkt|punkt)/i)
  if (!match) return null
  const line = Number(String(match[1]).replace(',', '.'))
  if (!Number.isFinite(line)) return null
  if (text.includes('over') || text.includes('powyzej') || text.includes('powyżej')) {
    if (total > line) return { status: 'won', reason: `Over ${line}, total=${total}` }
    if (total < line) return { status: 'lost', reason: `Over ${line}, total=${total}` }
    return { status: 'void', reason: `Push Over ${line}, total=${total}` }
  }
  if (text.includes('under') || text.includes('ponizej') || text.includes('poniżej')) {
    if (total < line) return { status: 'won', reason: `Under ${line}, total=${total}` }
    if (total > line) return { status: 'lost', reason: `Under ${line}, total=${total}` }
    return { status: 'void', reason: `Push Under ${line}, total=${total}` }
  }
  return null
}

function resolveBtts(tip, homeGoals, awayGoals) {
  const text = marketText(tip)
  if (!(text.includes('btts') || text.includes('obie') || text.includes('both teams'))) return null
  const yes = text.includes('tak') || text.includes('yes') || text.includes('btts')
  const hit = homeGoals > 0 && awayGoals > 0
  return { status: yes === hit ? 'won' : 'lost', reason: `BTTS yes=${yes}, hit=${hit}` }
}

function resolveTip(tip, homeGoals, awayGoals) {
  return resolveOverUnder(tip, homeGoals, awayGoals) || resolveBtts(tip, homeGoals, awayGoals) || resolve1x2(tip, homeGoals, awayGoals)
}

async function getFixture(fixtureId) {
  const key = apiFootballKey()
  if (!key) throw new Error('Brak API_FOOTBALL_KEY w Netlify ENV')
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(fixtureId)}`, {
    headers: { 'x-apisports-key': key }
  })
  if (!response.ok) throw new Error(`API-Football HTTP ${response.status}`)
  const payload = await response.json()
  const row = payload?.response?.[0]
  if (!row) return null
  return row
}

function buildSettlementPatch(tip, fixture, result) {
  const homeGoals = n(fixture?.goals?.home, 0)
  const awayGoals = n(fixture?.goals?.away, 0)
  const stake = n(tip.stake, 0)
  const odds = n(tip.odds || tip.course, 0)
  const payout = result.status === 'won' ? +(stake * odds).toFixed(2) : result.status === 'void' ? stake : 0
  const profit = result.status === 'won' ? +(payout - stake).toFixed(2) : result.status === 'void' ? 0 : -stake

  return {
    status: result.status,
    settlement_status: result.status,
    result_status: result.status,
    final_score_home: homeGoals,
    final_score_away: awayGoals,
    result_home: homeGoals,
    result_away: awayGoals,
    payout,
    return_amount: payout,
    profit,
    settled_at: new Date().toISOString(),
    settled_by: 'auto_api_football',
    settlement_source: 'api-football',
    settlement_note: result.reason || null,
    fixture_status: fixture?.fixture?.status?.short || null,
    fixture_json: fixture
  }
}

async function safeUpdateTip(supabase, id, patch) {
  let current = { ...patch }
  let lastError = null
  for (let i = 0; i < 18; i += 1) {
    const { data, error } = await supabase.from('tips').update(current).eq('id', id).select('*').maybeSingle()
    if (!error) return { data, error: null }
    lastError = error
    const missing = String(error.message || '').match(/'([^']+)' column of 'tips'/)?.[1]
    if (!missing || !(missing in current)) break
    delete current[missing]
  }
  return { data: null, error: lastError }
}

async function runAutoSettle(limit = 30) {
  const supabase = getSupabaseAdmin()
  const { data: tips, error } = await supabase
    .from('tips')
    .select('*')
    .in('status', ['pending', 'open', 'active'])
    .not('fixture_id', 'is', null)
    .limit(limit)

  if (error) throw error

  const settled = []
  const skipped = []
  const failed = []

  for (const tip of tips || []) {
    const fixtureId = tip.fixture_id || tip.api_fixture_id || tip.external_fixture_id
    if (!fixtureId) {
      skipped.push({ id: tip.id, reason: 'no fixture_id' })
      continue
    }

    try {
      const fixture = await getFixture(fixtureId)
      if (!fixture) {
        skipped.push({ id: tip.id, fixtureId, reason: 'fixture not found' })
        continue
      }

      const status = fixture?.fixture?.status?.short
      if (VOID_STATUS.has(status)) {
        const patch = buildSettlementPatch(tip, fixture, { status: 'void', reason: `Fixture status ${status}` })
        const update = await safeUpdateTip(supabase, tip.id, patch)
        if (update.error) throw update.error
        settled.push({ id: tip.id, status: 'void', fixtureId })
        continue
      }

      if (!FINISHED_STATUS.has(status)) {
        skipped.push({ id: tip.id, fixtureId, reason: `not finished: ${status || 'unknown'}` })
        continue
      }

      const homeGoals = n(fixture?.goals?.home, 0)
      const awayGoals = n(fixture?.goals?.away, 0)
      const result = resolveTip(tip, homeGoals, awayGoals)
      if (result.status === 'manual_review') {
        const update = await safeUpdateTip(supabase, tip.id, {
          status: 'pending_admin_review',
          settlement_status: 'pending_admin_review',
          settlement_note: result.reason,
          final_score_home: homeGoals,
          final_score_away: awayGoals,
          fixture_status: status,
          fixture_json: fixture
        })
        if (update.error) throw update.error
        skipped.push({ id: tip.id, fixtureId, reason: 'manual review market' })
        continue
      }

      const patch = buildSettlementPatch(tip, fixture, result)
      const update = await safeUpdateTip(supabase, tip.id, patch)
      if (update.error) throw update.error
      settled.push({ id: tip.id, fixtureId, status: result.status, score: `${homeGoals}:${awayGoals}` })
    } catch (error) {
      failed.push({ id: tip.id, fixtureId, error: String(error.message || error) })
    }
  }

  return { checked: (tips || []).length, settled, skipped, failed }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  try {
    const limit = Math.max(1, Math.min(80, Number(event.queryStringParameters?.limit || 30) || 30))
    const result = await runAutoSettle(limit)
    return json(200, { ok: true, ...result })
  } catch (error) {
    console.error('auto-settle-tips error:', error)
    return json(500, { ok: false, error: String(error.message || error) })
  }
}

exports.config = {
  schedule: '*/10 * * * *'
}
